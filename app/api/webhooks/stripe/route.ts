import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyStripeWebhookEvent, mapStripePriceToTier } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 * Inbound secure webhook gateway processing automated lifecycle hooks from Stripe.
 * * @param {NextRequest} req - The streaming HTTP request payload Context.
 * @returns {Promise<NextResponse>} Standard transaction compliance confirmation signature.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const signature = req.headers.get('stripe-signature');
        if (!signature) {
            return NextResponse.json({ error: 'Missing Required Stripe Signature Header' }, { status: 400 });
        }

        const rawBody = await req.text();
        let event: Stripe.Event;

        try {
            event = verifyStripeWebhookEvent(rawBody, signature);
        } catch (signatureError) {
            logger.warn({ err: signatureError, msg: 'Stripe Webhook Signature Verification Failed' });
            return NextResponse.json({ error: 'Invalid Webhook Cryptographic Signature' }, { status: 400 });
        }

        logger.info(`Inbound Stripe Webhook Verified: ${event.type} [ID: ${event.id}]`);

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const platformUserId = session.metadata?.platformUserId;
                
                if (!platformUserId) {
                    logger.warn(`Checkout Completed Event lacks platformUserId metadata. Session ID: ${session.id}`);
                    break;
                }

                const subscriptionId = typeof session.subscription === 'string' ? session.subscription : undefined;
                let priceId: string | undefined;

                const lineItems = session.line_items?.data || [];
                if (lineItems.length > 0) {
                    priceId = lineItems[0].price?.id;
                }

                const tier = mapStripePriceToTier(priceId);

                await db.doc(`users/${platformUserId}/billing/current`).set({
                    customerId: session.customer as string,
                    subscriptionId: subscriptionId || null,
                    priceId: priceId || null,
                    tier,
                    status: 'active',
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const billingQuery = await db
                    .collectionGroup('billing')
                    .where('customerId', '==', customerId)
                    .limit(1)
                    .get();

                if (billingQuery.empty) {
                    logger.warn(`Received subscription update hook for unmapped Stripe Customer ID: ${customerId}`);
                    break;
                }

                const billingDoc = billingQuery.docs[0];
                const firstItem = subscription.items.data[0];
                const priceId = firstItem?.price.id;
                const tier = mapStripePriceToTier(priceId);
                const status = subscription.status;

                const currentPeriodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000);

                await billingDoc.ref.set({
                    subscriptionId: subscription.id,
                    priceId,
                    tier: status === 'canceled' || status === 'unpaid' ? 'free' : tier,
                    status,
                    currentPeriodEnd, 
                    cancelAtPeriodEnd: subscription.cancel_at_period_end, 
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice & { subscription: string | Stripe.Subscription | null };
                const subscriptionId = invoice.subscription;
                
                if (!subscriptionId || typeof subscriptionId !== 'string') {
                    break;
                }

                const customerId = invoice.customer as string;
                const billingQuery = await db
                    .collectionGroup('billing')
                    .where('customerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!billingQuery.empty) {
                    await billingQuery.docs[0].ref.set({
                        status: 'active',
                        updatedAt: new Date().toISOString(),
                    }, { merge: true });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice & { subscription: string | Stripe.Subscription | null };
                const subscriptionId = invoice.subscription;
                
                if (!subscriptionId || typeof subscriptionId !== 'string') {
                    break;
                }

                const customerId = invoice.customer as string;
                const billingQuery = await db
                    .collectionGroup('billing')
                    .where('customerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!billingQuery.empty) {
                    await billingQuery.docs[0].ref.set({
                        status: 'past_due',
                        updatedAt: new Date().toISOString(),
                    }, { merge: true });
                }
                break;
            }

            default:
                logger.debug(`Unhandled or unmapped incoming Stripe event type dropped: ${event.type}`);
                break;
        }

        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error) {
        logger.error({ err: error, msg: 'Critical runtime error executing Stripe Webhook transactional listener' });
        return NextResponse.json({ error: 'Internal Webhook Failure' }, { status: 500 });
    }
}