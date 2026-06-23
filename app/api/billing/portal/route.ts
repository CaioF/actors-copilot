import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';

/**
 * POST /api/billing/portal
 * Generates a secure Stripe Customer Portal Session for self-service subscription management.
 * * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON compliance payload containing the target portal redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        // 1. Enforce strict authentication via the modern platform session cookie
        const session = await getPlatformSession();
        if (!session || !session.uid) {
            return NextResponse.json({ error: 'Unauthorized: Missing valid platform session' }, { status: 401 });
        }

        const { uid } = session;

        // 2. Retrieve the active customer billing configuration from Firestore
        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();
        
        const stripeCustomerId = billingDoc.exists ? billingDoc.data()?.customerId : null;

        // 3. Enforce business rule validation: Portal requires a pre-existing Stripe Customer identity
        if (!stripeCustomerId) {
            return NextResponse.json(
                { error: 'Bad Request: No active billing profile exists for this account.' },
                { status: 400 }
            );
        }

        // 4. Initialize the hosted Stripe Customer Portal configuration
        const returnUrl = process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL || 'http://localhost:3000/dashboard';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
        });

        // 5. Expose the generated URL structure for frontend redirection execution
        return NextResponse.json({ url: portalSession.url });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe customer portal session generation failed execution' });
        return NextResponse.json({ error: 'Internal Server Error during portal initialization' }, { status: 500 });
    }
}