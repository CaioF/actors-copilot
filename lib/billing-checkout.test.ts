import { findOpenCheckoutSession } from './billing-checkout';
import { stripe } from '@/lib/stripe';

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
