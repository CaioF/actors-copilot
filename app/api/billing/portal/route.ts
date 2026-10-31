import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db, auth } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { resolveAppUrl } from '@/lib/app-origin';

/**
 * POST /api/billing/portal
 * Generates a secure Stripe Customer Portal Session for self-service subscription management.
 * 
 * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON payload containing the target portal redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        let uid: string | undefined;

        // 1. Enforce strict authentication via platform session cookie or Firebase ID Token fallback
        const session = await getPlatformSession();
        if (session && session.uid) {
            uid = session.uid;
        } else {
            const authHeader = req.headers.get('authorization');
            let idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

            if (!idToken) {
                try {
                    const body = await req.json();
                    idToken = body?.idToken;
                } catch {
                    // Ignore empty body parsing error
                }
            }

            if (idToken) {
                try {
                    const decodedToken = await auth.verifyIdToken(idToken);
                    uid = decodedToken.uid;
                } catch (authErr) {
                    logger.warn({ err: authErr, msg: 'ID token verification failed in billing/portal endpoint' });
                }
            }
        }

        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized: Missing valid platform session' }, { status: 401 });
        }

        // 2. Retrieve active customer billing configuration from Firestore
        let stripeCustomerId: string | null = null;
        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();
        
        if (billingDoc.exists) {
            stripeCustomerId = billingDoc.data()?.customerId || null;
        }

        if (!stripeCustomerId) {
            const userDocRef = db.doc(`users/${uid}`);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                stripeCustomerId = userDoc.data()?.stripeCustomerId || userDoc.data()?.customerId || null;
            }
        }

        // 3. Enforce business rule validation: Portal requires a pre-existing Stripe Customer identity
        if (!stripeCustomerId) {
            return NextResponse.json(
                { error: 'Bad Request: No active billing profile exists for this account.' },
                { status: 400 }
            );
        }

        // 4. Initialize hosted Stripe Customer Portal configuration returning to /settings or environment setting
        // The return URL follows the origin of this request: the portal sends
        // the member back to a host, and only the origin they started from
        // holds their session.
        const appUrl = resolveAppUrl(req.headers);
        const returnUrl = process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL || `${appUrl}/settings`;

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
        });

        // 5. Expose generated URL structure for frontend redirection execution
        return NextResponse.json({ url: portalSession.url });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe customer portal session generation failed execution' });
        return NextResponse.json({ error: 'Internal Server Error during portal initialization' }, { status: 500 });
    }
}