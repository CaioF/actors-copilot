import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { setPlatformSession, getPlatformSession } from '@/lib/session';
import { UserBilling, SubscriptionStatus } from '@/lib/billing';

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
    }

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