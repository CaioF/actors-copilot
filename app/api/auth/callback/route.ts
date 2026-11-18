import { NextRequest, NextResponse } from 'next/server';
import { canRestartInvalidBillingTrial } from '@/lib/verified-trial-restart';
import { auth, db } from '@/lib/firebase.admin';
import { setPlatformSession, getPlatformSession } from '@/lib/session';
import type { UserBilling, MemberStatus, SubscriptionStatus } from '@/lib/billing';
import { unfinishedCheckout, owesFirstTrial, isCheckoutCustomerSeed } from '@/lib/first-checkout';
import type { PlatformSession } from '@/lib/session';
import { DEFAULT_RECOVERY_CURRENCY, DEFAULT_RECOVERY_TIER, isRecoveryPending } from '@/lib/billing-recovery';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { normalizeCurrency } from '@/lib/plan-selection';
import { buildAffiliateAttribution } from '@/lib/affiliate-attribution';
import { logger } from '@/lib/logger';
import { eligibleIdentity, readQaTrial, realEntitlement } from '@/lib/qa-affiliate-run';

/** Existing operator offers retain their retry limit. Resuming an ordinary checkout is user initiated. */
const MAX_RECOVERY_ATTEMPTS = 3;

function projectionErrorDetails(error: unknown) {
  const details = error as { name?: unknown; code?: unknown };
  return {
    errorName: typeof details?.name === 'string' ? details.name : 'UnknownError',
    errorCode:
      typeof details?.code === 'string' || typeof details?.code === 'number'
        ? details.code
        : undefined,
  };
}

async function memberSession(uid: string, email: string, member: Record<string, unknown>, billing: Record<string, unknown>) {
  const stored = billing as Partial<UserBilling> & { subscriptionStatus?: SubscriptionStatus };
  const invalidBinding = await canRestartInvalidBillingTrial(uid, member.billingRecovery, billing, true);
  const legacy = isRecoveryPending(member.billingRecovery) ? member.billingRecovery : null;
  const unfinished = unfinishedCheckout(member, billing);
  const demo = eligibleIdentity(uid, email) && !realEntitlement(billing) && !realEntitlement(member)
    ? await readQaTrial(uid, email) : null;
  const legacyRecovery = legacy && legacy.reason !== 'checkout_pending' && legacy.reason !== 'trial_selection' &&
    (legacy.attempt ?? 0) < MAX_RECOVERY_ATTEMPTS && (invalidBinding || owesFirstTrial(member, billing));
  const recovery = !demo && (unfinished || legacyRecovery) ? {
    required: true,
    tier: unfinished?.choice?.tier ?? legacy?.tier ?? DEFAULT_RECOVERY_TIER,
    currency: normalizeCurrency(unfinished?.choice?.currency ?? legacy?.currency ?? DEFAULT_RECOVERY_CURRENCY),
    billingCycle: unfinished?.choice?.billingCycle ?? legacy?.billingCycle ?? 'monthly',
  } : undefined;
  const tier = demo?.tier ?? (invalidBinding ? 'free' : stored.tier ?? 'free');
  let subscriptionStatus: MemberStatus = invalidBinding || (isCheckoutCustomerSeed(billing) && owesFirstTrial(member, billing))
    ? 'no_plan' : stored.status ?? stored.subscriptionStatus ?? 'no_plan';
  if (demo) subscriptionStatus = 'trialing';
  else if (recovery) subscriptionStatus = 'checkout_pending';
  const session: PlatformSession = {
    uid, email, tier, subscriptionStatus,
    stripeCustomerId: stored.customerId,
    stripeSubscriptionId: invalidBinding ? undefined : stored.subscriptionId,
    stripePriceId: invalidBinding ? undefined : stored.priceId,
    currentPeriodEnd: invalidBinding ? undefined : stored.currentPeriodEnd,
    ...(demo ? { qaExpiresAt: demo.expiresAt } : {}),
  };
  return { session, recovery };
}

/**
 * Validates the Firebase identity token, hydrates entitlement details from Firestore, and issues the active platform session.
 *
 * @param req - The incoming Next.js API request context.
 * @returns A JSON response with the updated entitlement state and session cookie.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { idToken, affiliateCode, affiliateCapturedAt, trialSignup } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing Identity ID Token' }, { status: 400 });
    }

    // 1. Verify the authenticity of the Firebase Identity Token using your auth instance
    const decodedToken = await auth.verifyIdToken(idToken); // Corrigido para "auth"
    const { uid, email } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: 'Identity Token lacks a valid email claim' }, { status: 400 });
    }

    const userDocRef = db.doc(`users/${uid}`);
    const [billingDoc, userDoc] = await Promise.all([
      db.doc(`users/${uid}/billing/current`).get(), userDocRef.get(),
    ]);
    let userData = userDoc.exists ? userDoc.data() ?? {} : {};
    const billing = billingDoc.exists ? billingDoc.data() ?? {} : {};

    // Affiliate attribution is written once, when the account is created, and
    // only when the root document does not exist yet. A later visit carrying
    // another referral link must not move the credit of a member that is
    // already paying.
    //
    // The capture timestamp is stored with it so the commission only counts
    // the payments that happened after the referral.
    let affiliateAttributed = false;

    if (!userDoc.exists) {
      const attribution = buildAffiliateAttribution(affiliateCode, affiliateCapturedAt);

      if (attribution || trialSignup === true) {
        const initial = {
          ...(attribution ? { affiliateCode: attribution.code, affiliateCapturedAt: attribution.capturedAt } : {}),
          ...(trialSignup === true && owesFirstTrial(userData, billing)
            ? { billingRecovery: { reason: 'trial_selection', required: true } } : {}),
        };
        try {
          await userDocRef.create(initial);
          userData = initial;
          affiliateAttributed = Boolean(attribution);
        } catch (error) {
          // Another tab or a webhook may already have recorded a newer choice or subscription.
          if ((error as { code?: number }).code !== 6) throw error;
          userData = (await userDocRef.get()).data() ?? {};
        }
      }
    }

    const { session, recovery: billingRecovery } = await memberSession(uid, email, userData, billing);
    await setPlatformSession(session);
    const { tier, subscriptionStatus } = session;

    try {
      await syncAdminMember(uid);
    } catch (error) {
      logger.error({
        ...projectionErrorDetails(error),
        msg: 'Admin member projection sync failed after login',
      });
    }

    return NextResponse.json({
      success: true,
      user: { uid, email, tier, subscriptionStatus },
      ...(billingRecovery ? { billingRecovery } : {}),
      ...(affiliateAttributed ? { affiliateAttributed: true } : {}),
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Authentication verification callback execution failed:', error);
    return NextResponse.json({ error: 'Internal Server Error during identity hydration' }, { status: 500 });
  }
}

/**
 * Returns the current platform entitlement context from the active session cookie.
 *
 * @returns A JSON response describing the current authentication state and entitlement tier.
 */
export async function GET(): Promise<NextResponse> {
  try {
    let session = await getPlatformSession();

    if (!session) {
      return NextResponse.json({ authenticated: false, tier: 'free' }, { status: 401 });
    }

    // The platform cookie can predate a checkout started on this or another device.
    let recovery;
    if (session.tier === 'free' || session.qaExpiresAt) {
      const [member, billing] = await Promise.all([
        db.doc(`users/${session.uid}`).get(), db.doc(`users/${session.uid}/billing/current`).get(),
      ]);
      const current = await memberSession(session.uid, session.email, member.data() ?? {}, billing.data() ?? {});
      recovery = current.recovery;
      if (session.tier !== current.session.tier || session.subscriptionStatus !== current.session.subscriptionStatus ||
          session.qaExpiresAt !== current.session.qaExpiresAt) await setPlatformSession(current.session);
      session = current.session;
    }
    return NextResponse.json({
      authenticated: true,
      ...(recovery ? { billingRecovery: recovery } : {}),
      tier: session.tier,
      subscriptionStatus: session.subscriptionStatus,
      stripeCustomerId: session.stripeCustomerId,
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Failed to retrieve runtime entitlement session context:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
