import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { db, auth } from '@/lib/firebase.admin';
import { BillingCycle, getStripePriceIdForTier, SubscriptionTier } from '@/lib/billing';
import { createOrReuseCheckoutSession } from '@/lib/billing-checkout';
import { resolveAppUrl } from '@/lib/app-origin';
import { logger } from '@/lib/logger';
import { normalizeCurrency, type RequestedCurrency } from '@/lib/plan-selection';

/**
 * POST /api/billing/checkout
 * Generates a secure Stripe Checkout Session for corporate tiered subscriptions.
 * * @param {NextRequest} req - The inbound Next.js HTTP request context.
 * @returns {Promise<NextResponse>} JSON compliance payload containing the target redirect URL.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        let body: Record<string, unknown>;
        try {
            const parsedBody = await req.json();
            body = parsedBody && typeof parsedBody === 'object' ? parsedBody as Record<string, unknown> : {};
        } catch {
            return NextResponse.json({ error: 'Malformed JSON request body' }, { status: 400 });
        }

        const { tier, billingCycle, isTrial: reqIsTrial, trial, idToken, currency }: { tier?: SubscriptionTier | 'trial'; billingCycle?: BillingCycle; isTrial?: boolean; trial?: boolean; idToken?: string; currency?: unknown } = body;

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

        const isExplicitTrialReq = Boolean(reqIsTrial || trial || tier === 'trial');
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

        // 2b. Only charge in a non-default currency when the Stripe Price is actually configured for it.
        let checkoutCurrency: RequestedCurrency | undefined;
        if (currency !== undefined && currency !== null) {
            const requestedCurrency = normalizeCurrency(typeof currency === 'string' ? currency : null);
            if (!requestedCurrency) {
                return NextResponse.json({ error: 'Unsupported currency specified', code: 'currency_invalid' }, { status: 400 });
            }

            let availableCurrencies: RequestedCurrency[];
            try {
                const { getPriceCurrencies } = await import('@/lib/billing-currency');
                availableCurrencies = await getPriceCurrencies(priceId);
            } catch (currencyErr) {
                logger.warn({ err: currencyErr, msg: 'Could not verify Stripe price currency support' });
                return NextResponse.json({ error: 'Could not verify payment currency. Please try again.', code: 'currency_unverified' }, { status: 503 });
            }

            if (!availableCurrencies.includes(requestedCurrency)) {
                return NextResponse.json({
                    error: `${requestedCurrency.toUpperCase()} checkout is not yet available for this plan.`,
                    code: 'currency_unavailable',
                }, { status: 400 });
            }
            checkoutCurrency = requestedCurrency;
        }

        // 3. Fetch active customer billing configurations from Firestore to prevent duplicate client entities & check trial eligibility
        const userDocRef = db.doc(`users/${uid}`);
        const billingDoc = await db.doc(`users/${uid}/billing/current`).get();

        let hasUsedTrial = false;

        if (billingDoc.exists) {
            const billingData = billingDoc.data();
            if (billingData?.hasUsedTrial) {
                hasUsedTrial = true;
            }
        }

        if (!hasUsedTrial) {
            try {
                const userDoc = await userDocRef.get();
                if (userDoc.exists && userDoc.data()?.hasUsedTrial) {
                    hasUsedTrial = true;
                }
            } catch (err) {
                logger.warn({ err, msg: 'Failed to inspect root user document for hasUsedTrial status' });
            }
        }

        if (hasUsedTrial && isExplicitTrialReq) {
            return NextResponse.json({ error: 'A free trial has already been used for this account.' }, { status: 400 });
        }

        // All checkout sessions allow for 14 days of free trial unless the user has already used a trial
        const isTrial = !hasUsedTrial;

        // 4. Resolve the Stripe Customer and open the checkout session.
        // Both steps are idempotent: concurrent requests for the same attempt
        // collapse into a single customer and a single Stripe Session.
        //
        // The redirect URLs are built from the origin of this request so that
        // the member returns to the very host they started from: the platform
        // cookie and the Firebase session live on that origin, and a different
        // host would send them back to the login screen.
        const appUrl = resolveAppUrl(req.headers);

        const checkoutSession = await createOrReuseCheckoutSession({
            uid,
            email,
            tier: selectedTier,
            billingCycle: selectedBillingCycle,
            ...(checkoutCurrency ? { currency: checkoutCurrency } : {}),
            isTrial,
            appUrl,
        });

        // Return URL object target for secure frontend execution routing
        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        logger.error({ err: error, msg: 'Stripe subscription checkout workflow failed execution' });
        return NextResponse.json({ error: 'Internal Server Error during checkout initialization' }, { status: 500 });
    }
}
