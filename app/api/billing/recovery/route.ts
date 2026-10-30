import { NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { db } from '@/lib/firebase.admin';
import { getStripePriceIdForTier } from '@/lib/billing';
import { getPriceCurrencies } from '@/lib/billing-currency';
import { createOrReuseCheckoutSession } from '@/lib/billing-checkout';
import { DEFAULT_RECOVERY_CURRENCY, DEFAULT_RECOVERY_TIER, isRecoveryPending } from '@/lib/billing-recovery';
import { normalizeCurrency, type RequestedCurrency } from '@/lib/plan-selection';
import { logger } from '@/lib/logger';

/**
 * POST /api/billing/recovery
 * Opens (or reuses) the Stripe Checkout Session for an account flagged for billing recovery.
 *
 * The endpoint is the single place where the recovery session is created. It is
 * idempotent, so calling it twice - or refreshing the page - never produces a
 * second Stripe Session nor a second Stripe Customer.
 *
 * @returns A JSON payload with the pending state and, when applicable, the checkout URL.
 */
export async function POST(): Promise<NextResponse> {
    try {
        const session = await getPlatformSession();
        if (!session?.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const uid = session.uid;
        const email = session.email;

        const userDocRef = db.doc(`users/${uid}`);
        const userDoc = await userDocRef.get();
        const userData = (userDoc.exists ? userDoc.data() : null) ?? ({} as Record<string, unknown>);

        const flag = userData.billingRecovery;
        if (!isRecoveryPending(flag)) {
            return NextResponse.json({ pending: false }, { status: 200 });
        }

        // Never re-open a checkout for an account that already has a subscription
        // or already redeemed its trial.
        const billingDoc = await db.doc(`users/${uid}/billing/current`).get();
        const billingData = (billingDoc.exists ? billingDoc.data() : null) ?? ({} as Record<string, unknown>);

        if (billingData.subscriptionId || billingData.hasUsedTrial === true) {
            return NextResponse.json({ pending: false }, { status: 200 });
        }

        const tier = flag.tier || DEFAULT_RECOVERY_TIER;
        const requestedCurrency = normalizeCurrency(flag.currency ?? DEFAULT_RECOVERY_CURRENCY);

        // The currency is only used when the target price really supports it.
        let currency: RequestedCurrency | undefined;
        try {
            const priceId = getStripePriceIdForTier(tier, 'monthly');
            const supported = await getPriceCurrencies(priceId);
            if (requestedCurrency && supported.includes(requestedCurrency)) {
                currency = requestedCurrency;
            }
        } catch (error) {
            logger.warn({ err: error, msg: 'Could not verify the recovery price currency' });
        }

        const checkoutSession = await createOrReuseCheckoutSession({
            uid,
            email,
            tier,
            billingCycle: 'monthly',
            ...(currency ? { currency } : {}),
            isTrial: true,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        });

        await userDocRef.update({
            'billingRecovery.attempt': (flag.attempt ?? 0) + 1,
            'billingRecovery.lastAttemptAt': new Date().toISOString(),
        } as Record<string, unknown>);

        return NextResponse.json({
            pending: true,
            tier,
            currency: currency ?? null,
            checkoutUrl: checkoutSession.url ?? null,
        }, { status: 200 });

    } catch (error) {
        logger.error({ err: error, msg: 'Billing recovery checkout could not be opened' });
        return NextResponse.json({ error: 'Could not open your checkout' }, { status: 500 });
    }
}
