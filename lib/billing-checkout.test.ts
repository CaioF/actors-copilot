import { findOpenCheckoutSession, isAllowedAppHost, isSameAppOrigin, resolveAppUrl } from './billing-checkout';
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

describe('checkout origin helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NEXT_PUBLIC_APP_URL = 'https://app.theactorscopilot.com';
    });

    describe('isAllowedAppHost', () => {
        it('accepts the production and preview hosts of this project', () => {
            expect(isAllowedAppHost('app.theactorscopilot.com')).toBe(true);
            expect(isAllowedAppHost('actors-copilot.vercel.app')).toBe(true);
            expect(isAllowedAppHost('v0-self-tape-copilot.vercel.app')).toBe(true);
            expect(isAllowedAppHost('actors-copilot-abc123-caiofs-projects.vercel.app')).toBe(true);
            expect(isAllowedAppHost('actors-copilot-git-main-caiofs-projects.vercel.app')).toBe(true);
        });

        it('rejects foreign hosts', () => {
            expect(isAllowedAppHost('evil.example.com')).toBe(false);
            expect(isAllowedAppHost('another-project.vercel.app')).toBe(false);
            expect(isAllowedAppHost('app.theactorscopilot.com.evil.test')).toBe(false);
            expect(isAllowedAppHost('')).toBe(false);
        });
    });

    describe('resolveAppUrl', () => {
        it('uses the forwarded host when it belongs to this project', () => {
            const headers = new Headers({
                'x-forwarded-host': 'app.theactorscopilot.com',
                'x-forwarded-proto': 'https',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('keeps the port of a local host out of the allow list and falls back', () => {
            const headers = new Headers({ host: 'localhost:3000' });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('falls back to the configured app URL for a foreign host', () => {
            const headers = new Headers({
                'x-forwarded-host': 'evil.example.com',
                'x-forwarded-proto': 'https',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('falls back to the configured app URL when no host is present', () => {
            expect(resolveAppUrl(new Headers())).toBe('https://app.theactorscopilot.com');
        });

        it('takes the first host of a proxied chain', () => {
            const headers = new Headers({
                'x-forwarded-host': 'app.theactorscopilot.com, internal.proxy.local',
                'x-forwarded-proto': 'https, http',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });
    });

    describe('isSameAppOrigin', () => {
        it('compares by host and ignores the path', () => {
            expect(
                isSameAppOrigin(
                    'https://app.theactorscopilot.com/api/billing/success?session_id=cs_1',
                    'https://app.theactorscopilot.com',
                ),
            ).toBe(true);
        });

        it('detects a different host', () => {
            expect(
                isSameAppOrigin(
                    'https://actors-copilot.vercel.app/api/billing/success',
                    'https://app.theactorscopilot.com',
                ),
            ).toBe(false);
        });

        it('treats an unparsable URL as a different origin', () => {
            expect(isSameAppOrigin('not-a-url', 'https://app.theactorscopilot.com')).toBe(false);
        });
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
