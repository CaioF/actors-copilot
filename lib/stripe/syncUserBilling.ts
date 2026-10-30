import type Stripe from 'stripe';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { stripe } from '@/lib/stripe';
import { mapStripePriceToTier } from '@/lib/billing';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';

/**
 * Firestore Admin SDK rejects `undefined`; convert those values to `null`.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = value === undefined ? null : value;
    }
    return cleaned;
}

export function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
    if (!customer) return null;
    return typeof customer === 'string' ? customer : customer.id;
}

export function projectionErrorDetails(error: unknown) {
    const details = error as { name?: unknown; code?: unknown };
    return {
        errorName: typeof details?.name === 'string' ? details.name : 'UnknownError',
        errorCode:
            typeof details?.code === 'string' || typeof details?.code === 'number'
                ? details.code
                : undefined,
    };
}

/**
 * Idempotently updates the user's billing document and root user profile in Firestore.
 * Shared by the Stripe webhook and the checkout success redirect.
 */
export async function syncUserBilling(platformUserId: string, data: Record<string, any>): Promise<void> {
    const billingRef = db.doc(`users/${platformUserId}/billing/current`);
    const userRef = db.doc(`users/${platformUserId}`);

    const payload = sanitizeFirestorePayload({
        ...data,
        subscriptionStatus: data.status,
        updatedAt: new Date().toISOString(),
    });

    await billingRef.set(payload, { merge: true });

    const userPayload: Record<string, any> = {
        stripeCustomerId: data.customerId ?? null,
        subscriptionStatus: data.status ?? null,
        hasAccess: data.hasAccess ?? null,
        tier: data.tier ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        cancelAt: data.cancelAt ?? null,
        updatedAt: new Date().toISOString(),
    };

    if (data.hasUsedTrial !== undefined) {
        userPayload.hasUsedTrial = data.hasUsedTrial;
    }

    await userRef.set(sanitizeFirestorePayload(userPayload), { merge: true });

    try {
        await syncAdminMember(platformUserId);
    } catch (error) {
        logger.error({
            ...projectionErrorDetails(error),
            msg: 'Admin member projection sync failed after billing persistence',
        });
    }
}

/**
 * Pulls the authoritative subscription state for a completed Checkout Session
 * straight from Stripe and persists it, so the success redirect does not depend
 * on the webhook having already arrived.
 *
 * @returns true when a subscription was found and synced.
 */
export async function syncFromCheckoutSession(session: Stripe.Checkout.Session): Promise<boolean> {
    const uid = session.client_reference_id;
    const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!uid || !subscriptionId) return false;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price?.id ?? null;
    const status = subscription.status;
    const tier = session.metadata?.targetTier || (priceId ? mapStripePriceToTier(priceId) : 'free');
    const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };

    await syncUserBilling(uid, {
        customerId: extractCustomerId(session.customer),
        subscriptionId,
        priceId,
        tier,
        status,
        hasAccess: ['trialing', 'active'].includes(status),
        hasUsedTrial: status === 'trialing' ? true : undefined,
        trialStart: subscription.trial_start ?? null,
        trialEnd: subscription.trial_end ?? null,
        currentPeriodEnd: subscriptionWithPeriod.current_period_end ?? firstItem?.current_period_end ?? null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        cancelAt: subscription.cancel_at ?? null,
    });

    return true;
}
