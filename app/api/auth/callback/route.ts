import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin'; // Alinhado com o seu arquivo real
import { setPlatformSession, getPlatformSession } from '@/lib/session';
import { UserBilling, SubscriptionStatus } from '@/lib/billing';

/**
 * Feature flag to determine the active downstream billing architecture.
 */
const BILLING_ENGINE = process.env.BILLING_ENGINE || 'STRIPE';

/**
 * POST /api/auth/auth-callback
 * Validates the Firebase ID token, hydrates entitlements from Firestore, and issues the session cookie[cite: 21].
 * * @param {NextRequest} req - The incoming Next.js API request context.
 * @returns {Promise<NextResponse>} HTTP compliance payload with session cookies assigned.
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

    if (BILLING_ENGINE === 'STRIPE') {
      // 2. Resolve target billing state snapshot natively from Firestore using your db instance
      const billingDocRef = db.doc(`users/${uid}/billing/current`); // Corrigido para "db"
      const billingDoc = await billingDocRef.get();

      if (billingDoc.exists) {
        const billingData = billingDoc.data() as Omit<UserBilling, 'uid'>;
        tier = billingData.tier || 'free';
        subscriptionStatus = billingData.status || 'canceled';
        stripeCustomerId = billingData.customerId;
        stripeSubscriptionId = billingData.subscriptionId;
        stripePriceId = billingData.priceId;
        currentPeriodEnd = billingData.currentPeriodEnd;
      } else {
        // Fallback or seed state initialization for fresh registrations
        tier = 'free';
        subscriptionStatus = 'canceled';
      }
    } else {
      // Legacy Fallback Gating path (Kajabi Integration Mock/Bridge) [cite: 26]
      tier = 'free'; 
      subscriptionStatus = 'active';
    }

    // 3. Serialize and commit metadata properties into the secure platform JWT session [cite: 23]
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

    return NextResponse.json({ 
      success: true, 
      user: { uid, email, tier, subscriptionStatus } 
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Authentication verification callback execution failed:', error);
    return NextResponse.json({ error: 'Internal Server Error during identity hydration' }, { status: 500 });
  }
}

/**
 * GET /api/auth/auth-callback
 * Synchronously reads the active JWT claims context to return runtime platform entitlements[cite: 26].
 * * @returns {Promise<NextResponse>} Instantaneous structural profile or 401 unauthenticated boundary.
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