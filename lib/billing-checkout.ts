import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { getStripePriceIdForTier, type BillingCycle, type SubscriptionTier } from '@/lib/billing';

/**
 * Detects the Stripe "idempotency key is already in use" conflict.
 *
 * Stripe answers a concurrent request that reuses a key which is still being
 * processed with a 409 `idempotency_error`. The original request is the
 * authoritative one, so the caller only has to wait for its result.
 *
 * @param error - The rejected error object.
 * @returns {boolean} True when the error represents an idempotency conflict.
 */
function isIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { type?: string; code?: string; raw?: { type?: string } };
  return (
    candidate.type === 'idempotency_error' ||
    candidate.raw?.type === 'idempotency_error' ||
    candidate.code === 'idempotency_key_in_use'
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves the Stripe Customer for a platform user, creating it at most once.
 *
 * The customer is created with a deterministic idempotency key derived from the
 * platform user id. Two concurrent checkout requests therefore resolve to the
 * same Stripe Customer instead of minting an orphan duplicate.
 *
 * @param params - The platform user identity.
 * @param params.uid - The platform user identifier.
 * @param params.email - The user email used for the Stripe Customer.
 * @param params.knownCustomerId - A customer id already persisted in Firestore.
 * @returns {Promise<string>} The Stripe Customer id.
 */
export async function resolveStripeCustomerId(params: {
  uid: string;
  email: string;
  knownCustomerId?: string;
}): Promise<string> {
  const { uid, email, knownCustomerId } = params;
  if (knownCustomerId) return knownCustomerId;

  const billingDocRef = db.doc(`users/${uid}/billing/current`);

  try {
    const customer = await stripe.customers.create(
      {
        email,
        metadata: {
          platformUserId: uid,
          firebaseUid: uid,
        },
      },
      { idempotencyKey: `cust_${uid}` },
    );

    await billingDocRef.set(
      {
        customerId: customer.id,
        tier: 'free',
        status: 'canceled',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return customer.id;
  } catch (error) {
    if (!isIdempotencyConflict(error)) throw error;

    // A concurrent request won the race and is creating the very same customer.
    // Wait for it to persist the id instead of failing the checkout.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(250);
      const snap = await billingDocRef.get();
      const persisted = snap.data()?.customerId as string | undefined;
      if (persisted) return persisted;
    }

    throw error;
  }
}

/**
 * Creates a Stripe Checkout Session guarded by a deterministic idempotency key.
 *
 * The key is composed by platform user, price and attempt number. Concurrent
 * requests for the same attempt collapse into a single Stripe Session, while a
 * genuine new attempt (after an abandoned checkout) produces a fresh key.
 *
 * @param params - The checkout parameters.
 * @returns {Promise<Stripe.Checkout.Session>} The created (or reused) session.
 */
export async function createIdempotentCheckoutSession(params: {
  uid: string;
  email: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  currency?: string;
  isTrial: boolean;
  customerId: string;
  attempt: number;
  appUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { uid, tier, billingCycle, currency, isTrial, customerId, attempt, appUrl } = params;
  const priceId = getStripePriceIdForTier(tier, billingCycle);

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      customer: customerId,
      client_reference_id: uid,
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      ...(currency ? { currency } : {}),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          firebaseUid: uid,
          platformUserId: uid,
          targetTier: tier,
        },
        ...(isTrial ? { trial_period_days: 14 } : {}),
      },
      ...(isTrial ? { payment_method_collection: 'always' as const } : {}),
      success_url: `${appUrl}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/api/billing/cancelled`,
      metadata: {
        platformUserId: uid,
        firebaseUid: uid,
        targetTier: tier,
        billingCycle,
        isTrial: isTrial ? 'true' : 'false',
      },
    },
    { idempotencyKey: `checkout_${uid}_${priceId}_${attempt}` },
  );

  return checkoutSession;
}

/**
 * Reuses a still-open checkout session for the same plan when one exists.
 *
 * Prevents the accumulation of redundant Stripe Sessions when the same user
 * triggers the checkout more than once (double click, page reload, two tabs).
 *
 * @param params - The lookup criteria.
 * @returns {Promise<Stripe.Checkout.Session | null>} The reusable session, if any.
 */
export async function findOpenCheckoutSession(params: {
  customerId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  currency?: string;
}): Promise<Stripe.Checkout.Session | null> {
  const { customerId, tier, billingCycle, currency } = params;

  try {
    const listed = await stripe.checkout.sessions.list({
      customer: customerId,
      status: 'open',
      limit: 10,
    });

    const now = Math.floor(Date.now() / 1000);
    const match = listed.data.find(
      (session) =>
        session.metadata?.targetTier === tier &&
        session.metadata?.billingCycle === billingCycle &&
        session.expires_at > now &&
        (!currency || session.currency === currency),
    );

    return match ?? null;
  } catch (error) {
    logger.warn({ err: error, msg: 'Could not look up an open checkout session' });
    return null;
  }
}

/**
 * Creates (or reuses) a checkout session for a platform user in one step.
 *
 * This is the single entry point used by both the checkout endpoint and the
 * login recovery flow, so both benefit from the same idempotency guarantees.
 *
 * @param params - The checkout parameters.
 * @returns {Promise<Stripe.Checkout.Session>} The session to redirect to.
 */
export async function createOrReuseCheckoutSession(params: {
  uid: string;
  email: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  currency?: string;
  isTrial: boolean;
  appUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { uid, email, tier, billingCycle, currency, isTrial, appUrl } = params;

  const billingDocRef = db.doc(`users/${uid}/billing/current`);
  const billingDoc = await billingDocRef.get();
  const billingData = (billingDoc.data() ?? {}) as Record<string, unknown>;

  // The attempt counter is read once, before any write, so that concurrent
  // requests derive the very same idempotency key and collapse into a single
  // Stripe Session.
  const attempt = Number(billingData.checkoutAttempt ?? 0);

  const customerId = await resolveStripeCustomerId({
    uid,
    email,
    knownCustomerId: billingData.customerId as string | undefined,
  });

  const reusable = await findOpenCheckoutSession({ customerId, tier, billingCycle, currency });
  if (reusable) return reusable;

  const session = await createIdempotentCheckoutSession({
    uid,
    email,
    tier,
    billingCycle,
    currency,
    isTrial,
    customerId,
    attempt,
    appUrl,
  });

  await billingDocRef.set(
    {
      checkoutAttempt: attempt + 1,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return session;
}
