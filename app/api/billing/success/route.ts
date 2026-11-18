import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { UserBilling } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { logger } from '@/lib/logger';
import { eligibleIdentity, qaCheckoutFingerprint, readQaTrial, realEntitlement } from '@/lib/qa-affiliate-run';
import { getPlatformSession, setPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { isCheckoutCustomerSeed } from '@/lib/first-checkout';

async function approvedOpenCheckout(checkout: Stripe.Checkout.Session, uid: string, billing: Partial<UserBilling>) {
    if (checkout.status !== 'open' || checkout.mode !== 'subscription' || checkout.subscription || realEntitlement(billing)) {
        return null;
    }
    const buyer = await getPlatformSession();
    if (buyer?.uid !== uid || !eligibleIdentity(uid, buyer.email)) return null;
    const [trial, member] = await Promise.all([
        readQaTrial(uid, buyer.email),
        db.doc(`users/${uid}`).get(),
    ]);
    if (!trial || trial.checkout !== qaCheckoutFingerprint(checkout.id) || realEntitlement(member.data())) {
        return null;
    }
    return { tier: trial.tier, expiresAt: trial.expiresAt, email: buyer.email };
}

/** Exchange the provider return for the buyer's refreshed platform session. */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const dashboard = NextResponse.redirect(new URL('/dashboard', req.url));
    dashboard.headers.set('Cache-Control', 'no-store');
    try {
        const sessionId = new URL(req.url).searchParams.get('session_id');
        if (!sessionId) return dashboard;

        const checkout = await stripe.checkout.sessions.retrieve(sessionId);
        const uid = checkout.client_reference_id;
        if (!uid) return dashboard;

        const ref = db.doc(`users/${uid}/billing/current`);
        let billing: Partial<UserBilling> = (await ref.get()).data() ?? {};
        const completed = checkout.status === 'complete';
        const demo = completed ? null : await approvedOpenCheckout(checkout, uid, billing);
        if (!completed && !demo) return dashboard;

        // A genuine subscription's webhook may arrive just after the browser.
        if (completed && checkout.subscription) {
            for (let attempt = 0; attempt < 4; attempt += 1) {
                if (billing.tier && billing.tier !== 'free' && billing.status && billing.status !== 'canceled') break;
                await new Promise((resolve) => setTimeout(resolve, 500));
                billing = (await ref.get()).data() ?? billing;
            }
        }

        let email = demo?.email || checkout.customer_details?.email;
        if (!email) {
            try {
                email = (await db.doc(`users/${uid}`).get()).data()?.email;
            } catch (err) {
                logger.warn({ err, msg: 'Failed to read checkout email from user profile' });
            }
        }
        await setPlatformSession({
            uid,
            email: email ?? '',
            tier: demo?.tier ?? billing.tier ?? 'free',
            subscriptionStatus: demo ? 'trialing' : isCheckoutCustomerSeed(billing) ? 'checkout_pending' : billing.status ?? 'checkout_pending',
            ...(demo ? { qaExpiresAt: demo.expiresAt } : {}),
            stripeCustomerId: billing.customerId,
            stripeSubscriptionId: billing.subscriptionId,
            stripePriceId: billing.priceId,
            currentPeriodEnd: billing.currentPeriodEnd,
        });
    } catch (error) {
        logger.error({ err: error, msg: 'Error handling Stripe success redirect' });
    }
    return dashboard;
}
