import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db, auth } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';

/**
 * POST /api/create-portal-session
 * Generates a secure Stripe Customer Portal Session for self-service subscription management and cancellations.
 * 
 * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON payload containing the target portal redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        let uid: string | undefined;

        // 1. Enforce authentication via platform session cookie or Firebase ID Token header/body fallback
        const session = await getPlatformSession();
        if (session && session.uid) {
            uid = session.uid;
        } else {
            // Check Authorization header or JSON payload body for idToken fallback
            const authHeader = req.headers.get('authorization');
            let idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

            if (!idToken) {
                try {
                    const body = await req.json();
                    idToken = body?.idToken;
                } catch {
                    // Ignore JSON parsing failure if body is empty
                }
            }

            if (idToken) {
                try {
                    const decodedToken = await auth.verifyIdToken(idToken);
                    uid = decodedToken.uid;
                } catch (authErr) {
                    logger.warn({ err: authErr, msg: 'Firebase ID Token verification failed in create-portal-session' });
                }
            }
        }

        if (!uid) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing valid platform session or authentication token' },
                { status: 401 }
            );
        }

        // 2. Retrieve active customer billing configuration from Firestore
        let stripeCustomerId: string | null = null;

        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();
        
        if (billingDoc.exists) {
            stripeCustomerId = billingDoc.data()?.customerId || null;
        }

        // Fallback: check root user document if customerId is not found in billing subcollection
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

        // 4. Construct external customer portal session returning to user settings
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const returnUrl = `${appUrl}/settings`;

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
        });

        // 5. Expose generated URL structure for frontend redirection execution
        return NextResponse.json({ url: portalSession.url }, { status: 200 });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe customer portal session generation failed execution' });
        return NextResponse.json(
            { error: 'Internal Server Error during portal initialization' },
            { status: 500 }
        );
    }
}
