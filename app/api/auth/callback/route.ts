import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { setPlatformSession, getPlatformSession } from '@/lib/session';
import { UserBilling, SubscriptionStatus } from '@/lib/billing';
import { DEFAULT_RECOVERY_CURRENCY, DEFAULT_RECOVERY_TIER, isRecoveryPending } from '@/lib/billing-recovery';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { normalizeCurrency } from '@/lib/plan-selection';
import { logger } from '@/lib/logger';

/**
 * Upper bound of automatic checkout attempts for a single recovery flag.
 *
 * Prevents the login flow from trapping a user in a redirect loop when the
 * checkout is abandoned on purpose: after the limit the account simply keeps
 * using the regular upgrade page.
 */
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

/**
 * Validates the Firebase identity token, hydrates entitlement details from Firestore, and issues the active platform session.
 *
 * @param req - The incoming Next.js API request context.
 * @returns A JSON response with the updated entitlement state and session cookie.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing Identity ID Token' }, { status: 400 });
    }

    // 1. Verify the authenticity of the Firebase Identity Token using your auth instance
    const decodedToken = await auth.verifyIdToken(idToken); // Corrigido para "auth"
    const { uid, email } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: 'Identity Token lacks a valid email claim' }, { status: 400 });
    }

    let tier: 'free' | 'economy' | 'business' = 'free';
    let subscriptionStatus: SubscriptionStatus = 'canceled';
    let stripeCustomerId: string | undefined;
    let stripeSubscriptionId: string | undefined;
    let stripePriceId: string | undefined;
    let currentPeriodEnd: number | undefined;
    let hasUsedTrial = false;

    const billingDocRef = db.doc(`users/${uid}/billing/current`);
    const billingDoc = await billingDocRef.get();

    if (billingDoc.exists) {
      const billingData = billingDoc.data() as Omit<UserBilling, 'uid'>;
      tier = billingData.tier || 'free';
      subscriptionStatus = billingData.status || 'canceled';
      stripeCustomerId = billingData.customerId;
      stripeSubscriptionId = billingData.subscriptionId;
      stripePriceId = billingData.priceId;
      currentPeriodEnd = billingData.currentPeriodEnd;
      hasUsedTrial = billingData.hasUsedTrial === true;
    }

    // The root user document also carries the trial marker and the optional
    // billing recovery flag.
    const userDocRef = db.doc(`users/${uid}`);
    const userDoc = await userDocRef.get();
    const userData = (userDoc.exists ? userDoc.data() : null) ?? ({} as Record<string, unknown>);

    if (userData.hasUsedTrial === true) {
      hasUsedTrial = true;
    }

    const recoveryFlag = isRecoveryPending(userData.billingRecovery) ? userData.billingRecovery : null;

    // 3. Serialize and commit entitlement metadata into the secure platform session.
    await setPlatformSession({
      uid,
      email,
      tier,
      subscriptionStatus,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      currentPeriodEnd,
    });

    try {
      await syncAdminMember(uid);
    } catch (error) {
      logger.error({
        ...projectionErrorDetails(error),
        msg: 'Admin member projection sync failed after login',
      });
    }

    // 4. Billing recovery.
    // Accounts whose previous checkout failed because of a server-side
    // configuration fault are routed to a short interstitial that explains
    // what happened before handing them over to Stripe. The entitlement is
    // still granted by Stripe + webhook, never here.
    const recoveryAttempts = recoveryFlag?.attempt ?? 0;
    const recoveryEligible =
      recoveryFlag !== null &&
      recoveryAttempts < MAX_RECOVERY_ATTEMPTS &&
      tier === 'free' &&
      !stripeSubscriptionId &&
      !hasUsedTrial;

    const billingRecovery = recoveryEligible
      ? {
        required: true,
        tier: recoveryFlag.tier || DEFAULT_RECOVERY_TIER,
        currency: normalizeCurrency(recoveryFlag.currency ?? DEFAULT_RECOVERY_CURRENCY),
      }
      : undefined;

    return NextResponse.json({
      success: true,
      user: { uid, email, tier, subscriptionStatus },
      ...(billingRecovery ? { billingRecovery } : {}),
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
    const session = await getPlatformSession();

    if (!session) {
      return NextResponse.json({ authenticated: false, tier: 'free' }, { status: 401 });
    }

    // Returns structural modern entitlement mapping data needed by frontend hydration engines [cite: 26]
    return NextResponse.json({
      authenticated: true,
      tier: session.tier,
      subscriptionStatus: session.subscriptionStatus,
      stripeCustomerId: session.stripeCustomerId,
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Failed to retrieve runtime entitlement session context:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
