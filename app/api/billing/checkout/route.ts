import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { getStripePriceIdForTier, SubscriptionTier } from '@/lib/billing';
import { logger } from '@/lib/logger';

/**
 * POST /api/billing/checkout
 * Generates a secure Stripe Checkout Session for corporate tiered subscriptions.
 * * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON compliance payload containing the target redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        // 1. Enforce strict authentication via the modern platform session cookie
        const session = await getPlatformSession();
        if (!session || !session.uid) {
            return NextResponse.json({ error: 'Unauthorized: Missing valid platform session' }, { status: 401 });
        }

        const { uid, email } = session;
        const body = await req.json();
        const { tier }: { tier: SubscriptionTier } = body;

        if (!tier || (tier !== 'economy' && tier !== 'business')) {
            return NextResponse.json({ error: 'Invalid or unsupported subscription tier specified' }, { status: 400 });
        }

        // 2. Resolve the official Stripe Price ID corresponding to the requested tier
        let priceId: string;
        try {
            priceId = getStripePriceIdForTier(tier);
        } catch (tierError) {
            return NextResponse.json({ error: (tierError as Error).message }, { status: 400 });
        }

        // 3. Fetch active customer billing configurations from Firestore to prevent duplicate client entities
        const billingDocRef = db.doc(`users/${uid}/billing/current`);
        const billingDoc = await billingDocRef.get();
        
        let stripeCustomerId: string | undefined;

        if (billingDoc.exists) {
            const billingData = billingDoc.data();
            stripeCustomerId = billingData?.customerId;
        }

        // 4. Lazy-initialize Stripe Customer if no relationship mapping exists within the persistence layer
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email,
                metadata: {
                    platformUserId: uid,
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

        // 5. Construct the external checkout session posture with programmatic success and cancel parameters
        const returnUrl = process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL || 'http://localhost:3000/dashboard';

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnUrl}?checkout_status=cancelled`,
            metadata: {
                platformUserId: uid,
                targetTier: tier,
            },
        });

        // Return URL object target for secure frontend execution routing
        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe subscription checkout workflow failed execution' });
        return NextResponse.json({ error: 'Internal Server Error during checkout initialization' }, { status: 500 });
    }
}