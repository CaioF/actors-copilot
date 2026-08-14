import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { DocumentReference } from 'firebase-admin/firestore';
import { verifyStripeWebhookEvent, mapStripePriceToTier } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 * Inbound secure webhook gateway processing automated lifecycle hooks from Stripe.
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
                let platformUserId = session.client_reference_id || session.metadata?.platformUserId;
                const customerEmail = session.customer_details?.email || session.metadata?.originalEmail;

                if (!platformUserId && customerEmail) {
                    const userSnap = await db.collection('users')
                        .where('email', '==', customerEmail.toLowerCase().trim())
                        .limit(1)
                        .get();

                    if (!userSnap.empty) {
                        platformUserId = userSnap.docs[0].id;
                    }
                }

                if (!platformUserId) {
                    logger.warn(`Checkout Completed Event lacks platformUserId metadata and matching email user record. Session ID: ${session.id}`);
                    break;
                }

                const subscriptionId = typeof session.subscription === 'string' ? session.subscription : undefined;
                let priceId: string | undefined;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    priceId = subscription.items.data[0]?.price?.id;
                }
                if (!priceId) {
                    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                    priceId = lineItems.data[0]?.price?.id;
                }

                const tier = session.metadata?.targetTier || mapStripePriceToTier(priceId);
                const isMigrationFlow = session.metadata?.flow === 'subscriber_migration';

                await db.doc(`users/${platformUserId}/billing/current`).set({
                    customerId: session.customer as string,
                    subscriptionId: subscriptionId || null,
                    priceId: priceId || null,
                    tier,
                    status: 'active',
                    migrationSource: isMigrationFlow ? 'kajabi' : null,
                    migratedAt: isMigrationFlow ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                logger.info(`Successfully mapped subscription for user ${platformUserId} (Migration: ${isMigrationFlow})`);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const billingQuery = await db
                    .collectionGroup('billing')
                    .where('customerId', '==', customerId)
                    .limit(1)
                    .get();

                let billingRef: DocumentReference | null = null;

                if (!billingQuery.empty) {
                    billingRef = billingQuery.docs[0].ref;
                } else {
                    let platformUserId = subscription.metadata?.platformUserId;

                    if (!platformUserId) {
                        const customer = await stripe.customers.retrieve(customerId);
                        
                        if (!customer.deleted) {
                            platformUserId = customer.metadata?.platformUserId;
                            const customerEmail = customer.email;

                            if (!platformUserId && customerEmail) {
                                const userSnap = await db.collection('users')
                                    .where('email', '==', customerEmail.toLowerCase().trim())
                                    .limit(1)
                                    .get();

                                if (!userSnap.empty) {
                                    platformUserId = userSnap.docs[0].id;
                                }
                            }
                        }
                    }

                    if (platformUserId) {
                        billingRef = db.doc(`users/${platformUserId}/billing/current`);
                    }
                }

                if (!billingRef) {
                    logger.warn(`Received subscription hook for unmapped Stripe Customer ID: ${customerId}`);
                    break;
                }

                const firstItem = subscription.items.data[0];
                const priceId = firstItem?.price.id;
                const tier = mapStripePriceToTier(priceId);
                const status = subscription.status;

                const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };
                const currentPeriodEnd = subscriptionWithPeriod.current_period_end ?? firstItem?.current_period_end ?? Math.floor(Date.now() / 1000);

                await billingRef.set({
                    customerId,
                    subscriptionId: subscription.id,
                    priceId,
                    tier: status === 'canceled' || status === 'unpaid' ? 'free' : tier,
                    status,
                    currentPeriodEnd, 
                    cancelAtPeriodEnd: subscription.cancel_at_period_end, 
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                logger.info(`Successfully synchronized subscription status '${status}' for doc: ${billingRef.path}`);
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