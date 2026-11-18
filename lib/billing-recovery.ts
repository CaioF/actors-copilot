import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import type { BillingCycle, SubscriptionTier } from '@/lib/billing';
import { owesFirstTrial, type CheckoutChoice } from './first-checkout';
import { DEFAULT_CURRENCY, type RequestedCurrency } from '@/lib/plan-selection';

/**
 * Billing recovery flag.
 *
 * Routes a member back to trial selection or an unfinished first checkout.
 * Older operator-issued recovery flags can also carry expiry and retry terms.
 *
 * The flag never grants entitlement on its own: the subscription is still
 * created by Stripe and persisted by the webhook.
 */
export interface BillingRecoveryFlag {
  required: boolean;
  tier?: SubscriptionTier;
  currency?: RequestedCurrency;
  billingCycle?: BillingCycle;
  reason?: string;
  attempt?: number;
  lastAttemptAt?: string | null;
  expiresAt?: string | null;
  resolvedAt?: string | null;
  /** Operator-reviewed legacy pointer, verified against live Stripe on use. */
  invalidBillingRestart?: { subscriptionId: string };
}

export const DEFAULT_RECOVERY_TIER: SubscriptionTier = 'business';
export const DEFAULT_RECOVERY_CURRENCY: RequestedCurrency = DEFAULT_CURRENCY;

/** Persist a first-trial choice, or return false if subscription history now rules it out. */
export async function rememberFirstCheckout(uid: string, choice: CheckoutChoice, previousCustomer?: string): Promise<boolean> {
  const user = db.doc(`users/${uid}`);
  const billing = db.doc(`users/${uid}/billing/current`);
  return db.runTransaction(async transaction => {
    const [member, current] = await Promise.all([transaction.get(user), transaction.get(billing)]);
    const data = member.data() ?? {};
    const stored = current.data() ?? {};
    if (!owesFirstTrial(data, stored)) return false;
    const flag = data.billingRecovery;
    // A lookup of historical metadata must not overwrite a newer choice from another tab.
    if (previousCustomer && (flag || stored.customerId !== previousCustomer)) return true;
    if (flag && (flag.invalidBillingRestart || !isRecoveryPending(flag))) return true;
    transaction.set(user, { billingRecovery: { required: true, reason: 'checkout_pending', ...choice } },
      { mergeFields: ['billingRecovery'] });
    return true;
  });
}

/**
 * Decides whether a stored recovery flag must still be honoured.
 *
 * A flag is pending when it is explicitly required, has not been resolved and
 * has not expired.
 *
 * @param flag - The raw flag value read from Firestore.
 * @returns {boolean} True when the checkout recovery flow must run.
 */
export function isRecoveryPending(flag: unknown): flag is BillingRecoveryFlag {
  if (!flag || typeof flag !== 'object') return false;

  const candidate = flag as BillingRecoveryFlag;
  if (candidate.required !== true) return false;
  if (candidate.resolvedAt) return false;

  if (candidate.expiresAt) {
    const expiry = new Date(candidate.expiresAt).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) return false;
  }

  return true;
}

/**
 * Reads the pending billing recovery flag for a platform user.
 *
 * @param uid - The platform user identifier.
 * @returns {Promise<BillingRecoveryFlag | null>} The pending flag, or null when absent/expired.
 */
export async function readBillingRecoveryFlag(uid: string): Promise<BillingRecoveryFlag | null> {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return null;

    const raw = (snap.data() ?? {}).billingRecovery as BillingRecoveryFlag | undefined;
    return isRecoveryPending(raw) ? raw : null;
  } catch (error) {
    logger.warn({ err: error, msg: 'Could not read the billing recovery flag' });
    return null;
  }
}

/**
 * Marks a recovery flag as satisfied once the subscription really exists.
 *
 * Uses dotted field paths so the rest of the flag payload survives the update.
 *
 * @param uid - The platform user identifier.
 */
export async function markBillingRecoveryResolved(uid: string): Promise<void> {
  try {
    await db.doc(`users/${uid}`).update({
      'billingRecovery.required': false,
      'billingRecovery.resolvedAt': new Date().toISOString(),
    } as Record<string, unknown>);
  } catch (error) {
    logger.warn({ err: error, msg: 'Could not clear the billing recovery flag' });
  }
}
