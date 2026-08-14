import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { setPlatformSession, PlatformSession } from '@/lib/session';
import type Stripe from 'stripe';
import { UserBilling, SubscriptionTier, SubscriptionStatus } from '@/lib/billing';

/**
 * Handles the Stripe Checkout success redirect. It verifies the incoming
 * checkout session, reads the authoritative billing tier from Firestore (the
 * value the webhook should have written), and issues an updated
 * `platform_session` cookie containing the refreshed entitlement state.
 *
 * If any step fails, the user is redirected to the dashboard without
 * modifying session state.
 *
 * @param {NextRequest} req - Next.js incoming request for this route.
 * @returns {Promise<NextResponse>} Redirect response to the application dashboard.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }

        // Retrieve the Stripe Checkout session to obtain the platform user id and
        // any customer contact details Stripe captured at payment time.
        const sessionDetails = await stripe.checkout.sessions.retrieve(sessionId as string, {
            expand: ['customer_details'],
        });

        const uid = sessionDetails.client_reference_id as string | undefined;
        const emailFromStripe = (sessionDetails as any)?.customer_details?.email as string | undefined;

        if (!uid) {
            logger.error('UID not found on Stripe Checkout session');
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }

        // Read the authoritative billing document where the webhook writes the
        // user's updated entitlement (tier/status). This ensures we set the
        // session based on persisted state and not on client-supplied values.
        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();
        const billingData = billingDoc.exists ? billingDoc.data() : {};

        const currentTier = (billingData?.tier as string) || 'free';
        const subscriptionStatus = (billingData?.status as string) || 'canceled';

        // Try to determine the user's email from Stripe first, then fall back to
        // Firestore user record if available. We prefer Stripe's captured email
        // because it reflects the address used for the transaction.
        let email = emailFromStripe;
        if (!email) {
            try {
                const userDoc = await db.doc(`users/${uid}`).get();
                const userData = userDoc.exists ? userDoc.data() : undefined;
                email = (userData && (userData as any).email) || undefined;
            } catch (err) {
                logger.warn({ err, msg: 'Failed to read users/{uid} profile for email fallback' });
            }
        }


        // Build the canonical platform session payload to persist in the cookie.
        // The `setPlatformSession` helper handles JWT signing and cookie attributes
        // consistently with the authentication flow used elsewhere in the app.
        const response = NextResponse.redirect(new URL('/dashboard', req.url));

        const billing = billingData as Partial<UserBilling> | undefined;

        const sessionPayload: PlatformSession = {
            uid,
            email: email ?? '',
            tier: currentTier as SubscriptionTier,
            subscriptionStatus: subscriptionStatus as SubscriptionStatus,
            stripeCustomerId: billing?.customerId,
            stripeSubscriptionId: billing?.subscriptionId,
            stripePriceId: billing?.priceId,
            currentPeriodEnd: billing?.currentPeriodEnd,
        };

        // If `setPlatformSession` returns a token instead of writing the cookie,
        // the token should be attached to the `response` cookie store. In this
        // codebase `setPlatformSession` writes the signed JWT into Next's cookie
        // store, so calling it here will persist the session for the outgoing
        // response context.
        await setPlatformSession(sessionPayload);

        logger.info(`Platform session refreshed for uid=${uid} with tier=${currentTier}`);

        return response;
    } catch (error) {
        logger.error({ err: error, msg: 'Error handling Stripe success redirect' });
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }
}