import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { db } from '@/lib/firebase.admin';
import { getStripePriceIdForTier, type BillingCycle, type SubscriptionTier } from '@/lib/billing';
import { getPriceCurrencies } from '@/lib/billing-currency';
import { createOrReuseCheckoutSession } from '@/lib/billing-checkout';
import { DEFAULT_RECOVERY_CURRENCY, DEFAULT_RECOVERY_TIER, isRecoveryPending } from '@/lib/billing-recovery';
import { normalizeCurrency } from '@/lib/plan-selection';
import { logger } from '@/lib/logger';

/**
 * POST /api/billing/recovery
 *
 * Two phase endpoint for the trial recovery flow:
 *
 * - Without a selection it only reports whether the signed in account still
 *   owes the activation of its free trial.
 * - With a selection (`tier`, `billingCycle`, `currency`) it opens (or reuses)
 *   the Stripe Checkout Session for that choice.
 *
 * The session creation is idempotent, so calling it twice - or refreshing the
 * page - never produces a second Stripe Session nor a second Stripe Customer.
 *
 * @returns A JSON payload with the pending state and, when applicable, the checkout URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getPlatformSession();
        if (!session?.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const uid = session.uid;
        const email = session.email;

        let body: Record<string, unknown> = {};
        try {
            const parsed = await req.json();
            body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
        } catch {
            // An empty body is valid: it only asks for the pending state.
        }

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

        const defaultTier: SubscriptionTier = flag.tier || DEFAULT_RECOVERY_TIER;
        const defaultCurrency = normalizeCurrency(flag.currency ?? DEFAULT_RECOVERY_CURRENCY);

        // Phase 1: the caller only wants to know whether a checkout is pending.
        const wantsSelection = body.tier !== undefined;
        if (!wantsSelection) {
            return NextResponse.json(
                {
                    pending: true,
                    tier: defaultTier,
                    currency: defaultCurrency,
                },
                { status: 200 },
            );
        }

        // Phase 2: the caller picked a plan, a cycle and a currency.
        const tier: SubscriptionTier = body.tier === 'economy' ? 'economy' : 'business';
        const billingCycle: BillingCycle = body.billingCycle === 'annual' ? 'annual' : 'monthly';
        const requestedCurrency = normalizeCurrency(typeof body.currency === 'string' ? body.currency : null);

        if (requestedCurrency) {
            // The currency is only honoured when the target price supports it.
            const priceId = getStripePriceIdForTier(tier, billingCycle);
            const supported = await getPriceCurrencies(priceId);
            if (!supported.includes(requestedCurrency)) {
                return NextResponse.json(
                    {
                        error: `${requestedCurrency.toUpperCase()} is not available for this plan yet.`,
                        code: 'currency_unavailable',
                    },
                    { status: 400 },
                );
            }
        }

        const currency = requestedCurrency ?? defaultCurrency;

        const checkoutSession = await createOrReuseCheckoutSession({
            uid,
            email,
            tier,
            billingCycle,
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
            billingCycle,
            currency: currency ?? null,
            checkoutUrl: checkoutSession.url ?? null,
        }, { status: 200 });

    } catch (error) {
        logger.error({ err: error, msg: 'Billing recovery checkout could not be opened' });
        return NextResponse.json({ error: 'Could not open your checkout' }, { status: 500 });
    }
}
