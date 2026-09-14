import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db, auth } from '@/lib/firebase.admin';
import { BillingCycle, getStripePriceIdForTier, SubscriptionTier } from '@/lib/billing';
import { logger } from '@/lib/logger';

/**
 * POST /api/billing/checkout
 * Generates a secure Stripe Checkout Session for corporate tiered subscriptions.
 * * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON compliance payload containing the target redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { tier, billingCycle, isTrial: reqIsTrial, trial, idToken }: { tier?: SubscriptionTier | 'trial'; billingCycle?: BillingCycle; isTrial?: boolean; trial?: boolean; idToken?: string } = body;

        // 1. Enforce authentication via platform session cookie or Firebase ID Token fallback
        let uid: string | undefined;
        let email: string | undefined;

        const session = await getPlatformSession();
        if (session && session.uid) {
            uid = session.uid;
            email = session.email;
        } else if (idToken) {
            try {
                const decodedToken = await auth.verifyIdToken(idToken);
                uid = decodedToken.uid;
                email = decodedToken.email;
            } catch (authErr) {
                logger.warn({ err: authErr, msg: 'ID Token verification failed in checkout endpoint' });
            }
        }

        if (!uid || !email) {
            return NextResponse.json({ error: 'Unauthorized: Missing valid platform session or authentication token' }, { status: 401 });
        }

        const isTrial = Boolean(reqIsTrial || trial || tier === 'trial');
        const selectedTier: SubscriptionTier = (tier && tier !== 'trial') ? tier : 'business';
        const selectedBillingCycle: BillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly';

        if (!selectedTier || (selectedTier !== 'economy' && selectedTier !== 'business')) {
            return NextResponse.json({ error: 'Invalid or unsupported subscription tier specified' }, { status: 400 });
        }

        // 2. Resolve the official Stripe Price ID corresponding to the requested tier
        let priceId: string;
        try {
            priceId = getStripePriceIdForTier(selectedTier, selectedBillingCycle);
        } catch (tierError) {
            return NextResponse.json({ error: (tierError as Error).message }, { status: 400 });
        }

        // 3. Fetch active customer billing configurations from Firestore to prevent duplicate client entities & check trial eligibility
        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();

        let stripeCustomerId: string | undefined;

        if (billingDoc.exists) {
            const billingData = billingDoc.data();
            stripeCustomerId = billingData?.customerId;

            if (isTrial && billingData?.hasUsedTrial) {
                return NextResponse.json({ error: 'A free trial has already been used for this account.' }, { status: 400 });
            }
        }

        // 4. Lazy-initialize Stripe Customer if no relationship mapping exists within the persistence layer
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email,
                metadata: {
                    platformUserId: uid,
                    firebaseUid: uid,
                },
            });
            stripeCustomerId = customer.id;

            // Seed initial structure to Firestore to bind the client ID securely
            await billingDocRef.set({
                customerId: stripeCustomerId,
                tier: 'free',
                status: 'canceled',
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }

        // 5. Construct external checkout session with trial parameters & payment_method_collection = 'always'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            client_reference_id: uid,
            mode: 'subscription',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
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
                    targetTier: selectedTier,
                },
                ...(isTrial ? { trial_period_days: 14 } : {}),
            },
            ...(isTrial ? { payment_method_collection: 'always' as const } : {}),
            success_url: `${appUrl}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/api/billing/cancelled`,
            metadata: {
                platformUserId: uid,
                firebaseUid: uid,
                targetTier: selectedTier,
                billingCycle: selectedBillingCycle,
                isTrial: isTrial ? 'true' : 'false',
            },
        });

        // Return URL object target for secure frontend execution routing
        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe subscription checkout workflow failed execution' });
        return NextResponse.json({ error: 'Internal Server Error during checkout initialization' }, { status: 500 });
    }
}