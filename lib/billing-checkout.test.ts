import { createIdempotentCheckoutSession, findOpenCheckoutSession, originSlug } from './billing-checkout';
import { stripe } from '@/lib/stripe';
import { getStripePriceIdForTier } from '@/lib/billing';

jest.mock('@/lib/stripe', () => ({
    stripe: {
        customers: { create: jest.fn() },
        checkout: {
            sessions: {
                create: jest.fn(),
                list: jest.fn(),
                expire: jest.fn(),
            },
        },
    },
}));

jest.mock('@/lib/firebase.admin', () => ({
    db: { doc: jest.fn() },
}));

// The real module refuses to load without the Stripe Price IDs in the
// environment, and CI does not provide them.
jest.mock('@/lib/billing', () => ({
    getStripePriceIdForTier: jest.fn(),
}));

describe('originSlug', () => {
    it('turns a host into a key safe slug', () => {
        expect(originSlug('https://app.theactorscopilot.com')).toBe('app-theactorscopilot-com');
        expect(originSlug('https://actors-copilot.vercel.app')).toBe('actors-copilot-vercel-app');
    });

    it('falls back to a default for an unusable value', () => {
        expect(originSlug('not-a-url')).toBe('default');
    });
});

describe('createIdempotentCheckoutSession', () => {
    const baseParams = {
        uid: 'uid_1',
        email: 'member@example.com',
        tier: 'business' as const,
        billingCycle: 'monthly' as const,
        isTrial: true,
        customerId: 'cus_1',
        attempt: 0,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_business');
        (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/x' });
    });

    it('includes the origin in the idempotency key', async () => {
        await createIdempotentCheckoutSession({ ...baseParams, appUrl: 'https://app.theactorscopilot.com' });

        const options = (stripe.checkout.sessions.create as jest.Mock).mock.calls[0][1];
        // Stripe rejects a key reused with different parameters, and the
        // success and cancel URLs depend on the origin.
        expect(options.idempotencyKey).toBe('checkout_uid_1_price_business_default_0_app-theactorscopilot-com');
    });

    it('produces a different key for a different currency', async () => {
        await createIdempotentCheckoutSession({ ...baseParams, currency: 'usd', appUrl: 'https://app.theactorscopilot.com' });
        await createIdempotentCheckoutSession({ ...baseParams, currency: 'eur', appUrl: 'https://app.theactorscopilot.com' });

        const calls = (stripe.checkout.sessions.create as jest.Mock).mock.calls;
        expect(calls[0][1].idempotencyKey).not.toBe(calls[1][1].idempotencyKey);
    });

    it('produces a different key for a different origin', async () => {
        await createIdempotentCheckoutSession({ ...baseParams, appUrl: 'https://app.theactorscopilot.com' });
        await createIdempotentCheckoutSession({ ...baseParams, appUrl: 'https://actors-copilot.vercel.app' });

        const calls = (stripe.checkout.sessions.create as jest.Mock).mock.calls;
        expect(calls[0][1].idempotencyKey).not.toBe(calls[1][1].idempotencyKey);
    });

    it('builds the redirect URLs from the given origin', async () => {
        await createIdempotentCheckoutSession({ ...baseParams, appUrl: 'https://app.theactorscopilot.com' });

        const params = (stripe.checkout.sessions.create as jest.Mock).mock.calls[0][0];
        expect(params.success_url).toBe(
            'https://app.theactorscopilot.com/api/billing/success?session_id={CHECKOUT_SESSION_ID}',
        );
        expect(params.cancel_url).toBe('https://app.theactorscopilot.com/api/billing/cancelled');
    });
});

describe('findOpenCheckoutSession', () => {
    const baseSession = {
        id: 'cs_test_1',
        status: 'open',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        currency: 'usd',
        metadata: { targetTier: 'business', billingCycle: 'monthly' },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (stripe.checkout.sessions.expire as jest.Mock).mockResolvedValue({ id: 'cs_test_1', status: 'expired' });
    });

    it('reuses an open session that returns to the same origin', async () => {
        (stripe.checkout.sessions.list as jest.Mock).mockResolvedValue({
            data: [{ ...baseSession, success_url: 'https://app.theactorscopilot.com/api/billing/success?session_id=x' }],
        });

        const session = await findOpenCheckoutSession({
            customerId: 'cus_1',
            tier: 'business',
            billingCycle: 'monthly',
            appUrl: 'https://app.theactorscopilot.com',
        });

        expect(session?.id).toBe('cs_test_1');
        expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });

    it('expires a session created for another origin and opens a new one', async () => {
        (stripe.checkout.sessions.list as jest.Mock).mockResolvedValue({
            data: [{ ...baseSession, success_url: 'https://actors-copilot.vercel.app/api/billing/success?session_id=x' }],
        });

        const session = await findOpenCheckoutSession({
            customerId: 'cus_1',
            tier: 'business',
            billingCycle: 'monthly',
            appUrl: 'https://app.theactorscopilot.com',
        });

        // Returning the member to a host that holds neither their platform
        // cookie nor their Firebase session would land them on the login
        // screen, so the stale session is expired instead of reused.
        expect(session).toBeNull();
        expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_1');
    });

    it('keeps a session for a different plan untouched', async () => {
        (stripe.checkout.sessions.list as jest.Mock).mockResolvedValue({
            data: [
                {
                    ...baseSession,
                    metadata: { targetTier: 'economy', billingCycle: 'monthly' },
                    success_url: 'https://actors-copilot.vercel.app/api/billing/success?session_id=x',
                },
            ],
        });

        const session = await findOpenCheckoutSession({
            customerId: 'cus_1',
            tier: 'business',
            billingCycle: 'monthly',
            appUrl: 'https://app.theactorscopilot.com',
        });

        expect(session).toBeNull();
        expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });
});
