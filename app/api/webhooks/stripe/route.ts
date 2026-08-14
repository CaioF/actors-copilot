import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyStripeWebhookEvent, mapStripePriceToTier } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Sanitizes an object for Firestore by converting `undefined` values to `null`
 * to prevent Firestore Admin SDK serialization crashes.
 */
function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = value === undefined ? null : value;
    }
    return cleaned;
}

/**
 * Extracts a customer ID string safely from any Stripe reference.
 */
function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
    if (!customer) return null;
    return typeof customer === 'string' ? customer : customer.id;
}

/**
 * Resolves a Firebase UID across metadata variants (platformUserId, userId, uid, etc.).
 */
function extractUidFromMetadata(metadata?: Stripe.Metadata | null): string | null {
    if (!metadata) return null;
    return (
        metadata.platformUserId ||
        metadata.userId ||
        metadata.uid ||
        metadata.firebaseUID ||
        metadata.firebaseUserId ||
        null
    );
}

/**
 * Resilient multi-layer resolution to find the Firebase UID associated with a Stripe event.
 */
async function resolvePlatformUserId(params: {
    directUid?: string | null;
    metadata?: Stripe.Metadata | null;
    customerId?: string | null;
    email?: string | null;
}): Promise<string | null> {
    // 1. Direct UID or metadata on current object
    const explicitUid = params.directUid || extractUidFromMetadata(params.metadata);
    if (explicitUid) return explicitUid;

    const { customerId, email } = params;

    // 2. Query billing collectionGroup by customerId
    if (customerId) {
        try {
            const billingSnap = await db
                .collectionGroup('billing')
                .where('customerId', '==', customerId)
                .limit(1)
                .get();

            if (!billingSnap.empty) {
                // Path format: users/{platformUserId}/billing/{docId}
                const pathParts = billingSnap.docs[0].ref.path.split('/');
                const userIndex = pathParts.indexOf('users');
                if (userIndex !== -1 && pathParts[userIndex + 1]) {
                    return pathParts[userIndex + 1];
                }
            }
        } catch (cgErr) {
            logger.warn({ err: cgErr, msg: 'collectionGroup(billing) query failed or missing index' });
        }

        // 3. Query root users collection by stored customerId
        try {
            const userCustomerSnap = await db.collection('users')
                .where('stripeCustomerId', '==', customerId)
                .limit(1)
                .get();

            if (!userCustomerSnap.empty) {
                return userCustomerSnap.docs[0].id;
            }
        } catch (err) {
            // non-blocking
        }

        // 4. Retrieve Stripe Customer and inspect customer metadata & email
        try {
            const customer = await stripe.customers.retrieve(customerId);
            if (!customer.deleted) {
                const customerUid = extractUidFromMetadata(customer.metadata);
                if (customerUid) return customerUid;

                if (!email && customer.email) {
                    params.email = customer.email;
                }
            }
        } catch (stripeErr) {
            logger.warn({ err: stripeErr, msg: `Failed to retrieve customer ${customerId} from Stripe` });
        }
    }

    // 5. Fallback: Search Firestore users by email
    if (params.email) {
        const normalizedEmail = params.email.toLowerCase().trim();
        const userEmailSnap = await db.collection('users')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();

        if (!userEmailSnap.empty) {
            return userEmailSnap.docs[0].id;
        }
    }

    return null;
}

/**
 * Idempotently updates the user's billing document in Firestore.
 */
async function syncUserBilling(platformUserId: string, data: Record<string, any>): Promise<void> {
    const billingRef = db.doc(`users/${platformUserId}/billing/current`);
    const payload = sanitizeFirestorePayload({
        ...data,
        updatedAt: new Date().toISOString(),
    });
    await billingRef.set(payload, { merge: true });
}

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
                const customerId = extractCustomerId(session.customer);
                const email = session.customer_details?.email || session.metadata?.originalEmail || session.customer_email;

                const platformUserId = await resolvePlatformUserId({
                    directUid: session.client_reference_id,
                    metadata: session.metadata,
                    customerId,
                    email,
                });

                if (!platformUserId) {
                    logger.warn(`[checkout.session.completed] Could not resolve platformUserId for Session ID: ${session.id}`);
                    break;
                }

                const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
                let priceId: string | null = null;

                if (subscriptionId) {
                    try {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        priceId = subscription.items.data[0]?.price?.id || null;
                    } catch (subErr) {
                        logger.warn({ err: subErr, msg: `Failed to retrieve subscription ${subscriptionId}` });
                    }
                }

                if (!priceId) {
                    try {
                        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                        priceId = lineItems.data[0]?.price?.id || null;
                    } catch (itemErr) {
                        logger.warn({ err: itemErr, msg: `Failed to retrieve line items for session ${session.id}` });
                    }
                }

                const tier = session.metadata?.targetTier || (priceId ? mapStripePriceToTier(priceId) : 'free');
                const isMigrationFlow = session.metadata?.flow === 'subscriber_migration';

                await syncUserBilling(platformUserId, {
                    customerId,
                    subscriptionId: subscriptionId || null,
                    priceId: priceId || null,
                    tier,
                    status: 'active',
                    migrationSource: isMigrationFlow ? 'kajabi' : null,
                    migratedAt: isMigrationFlow ? new Date().toISOString() : null,
                });

                logger.info(`[checkout.session.completed] Successfully synced user ${platformUserId}`);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = extractCustomerId(subscription.customer);

                const platformUserId = await resolvePlatformUserId({
                    metadata: subscription.metadata,
                    customerId,
                });

                if (!platformUserId) {
                    logger.warn(`[${event.type}] Could not resolve platformUserId for Customer: ${customerId}, Sub: ${subscription.id}`);
                    break;
                }

                const firstItem = subscription.items.data[0];
                const priceId = firstItem?.price?.id || null;
                const tier = priceId ? mapStripePriceToTier(priceId) : 'free';
                const status = subscription.status;

                const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };
                const currentPeriodEnd =
                    subscriptionWithPeriod.current_period_end ??
                    firstItem?.current_period_end ??
                    Math.floor(Date.now() / 1000);

                await syncUserBilling(platformUserId, {
                    customerId,
                    subscriptionId: subscription.id,
                    priceId,
                    tier: status === 'canceled' || status === 'unpaid' ? 'free' : tier,
                    status,
                    currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
                });

                logger.info(`[${event.type}] Successfully synced status '${status}' for user ${platformUserId}`);
                break;
            }

            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = extractCustomerId(invoice.customer);
                const isPaid = event.type === 'invoice.payment_succeeded';

                const platformUserId = await resolvePlatformUserId({
                    customerId,
                    email: invoice.customer_email,
                });

                if (platformUserId) {
                    await syncUserBilling(platformUserId, {
                        customerId,
                        status: isPaid ? 'active' : 'past_due',
                    });
                    logger.info(`[${event.type}] Updated billing status to '${isPaid ? 'active' : 'past_due'}' for user ${platformUserId}`);
                }
                break;
            }

            default:
                logger.debug(`Unhandled incoming Stripe event type: ${event.type}`);
                break;
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
        logger.error({ err: error, msg: 'Critical error processing Stripe Webhook' });
        return NextResponse.json({ error: 'Internal Webhook Failure' }, { status: 500 });
    }
}