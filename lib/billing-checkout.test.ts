import { createIdempotentCheckoutSession, findOpenCheckoutSession, originSlug, resolveStripeCustomerId } from './billing-checkout';
import { stripe } from '@/lib/stripe';
import { getStripePriceIdForTier } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';

jest.mock('@/lib/stripe', () => ({
    stripe: {
        customers: { create: jest.fn(), retrieve: jest.fn() },
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
        expect(options.idempotencyKey).toBe(
            'checkout_uid_1_price_business_default_0_app-theactorscopilot-com_cus_1',
        );
    });

    it('produces a different key for a different customer', async () => {
        // The customer is a parameter of the session. An account whose stored
        // customer is gone gets a fresh one, and a reused key with different
        // parameters is rejected by Stripe.
        await createIdempotentCheckoutSession({
            ...baseParams,
            customerId: 'cus_1',
            appUrl: 'https://app.theactorscopilot.com',
        });
        await createIdempotentCheckoutSession({
            ...baseParams,
            customerId: 'cus_2',
            appUrl: 'https://app.theactorscopilot.com',
        });

        const calls = (stripe.checkout.sessions.create as jest.Mock).mock.calls;
        expect(calls[0][1].idempotencyKey).not.toBe(calls[1][1].idempotencyKey);
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

describe('resolveStripeCustomerId', () => {
    const setMock = jest.fn();
    const getMock = jest.fn();
    const billingDocRef = { set: setMock, get: getMock };

    beforeEach(() => {
        jest.clearAllMocks();
        (db.doc as jest.Mock).mockReturnValue(billingDocRef);
        setMock.mockResolvedValue(undefined);
        getMock.mockReset().mockResolvedValue({ data: () => ({}) });
    });

    it('reuses the stored customer when Stripe still knows it', async () => {
        (stripe.customers.retrieve as jest.Mock).mockResolvedValue({ id: 'cus_alive', deleted: false });

        const customerId = await resolveStripeCustomerId({
            uid: 'uid_1',
            email: 'member@example.com',
            knownCustomerId: 'cus_alive',
        });

        expect(customerId).toBe('cus_alive');
        expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it('creates a fresh customer when the stored one was deleted', async () => {
        // Stripe answers a deleted customer with a tombstone instead of an error.
        (stripe.customers.retrieve as jest.Mock).mockResolvedValue({ id: 'cus_gone', deleted: true });
        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_new' });

        const customerId = await resolveStripeCustomerId({
            uid: 'uid_1',
            email: 'member@example.com',
            knownCustomerId: 'cus_gone',
        });

        expect(customerId).toBe('cus_new');
        expect(stripe.customers.create).toHaveBeenCalledTimes(1);
        // The dead id is replaced in Firestore, so the next request reuses the
        // customer that actually exists.
        expect(setMock).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 'cus_new' }),
            { merge: true },
        );
    });

    it('creates a fresh customer when the stored one does not exist at all', async () => {
        // A customer created in test mode is invisible to the live key.
        (stripe.customers.retrieve as jest.Mock).mockRejectedValue(
            Object.assign(new Error("No such customer: 'cus_test'"), { code: 'resource_missing' }),
        );
        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_new' });

        const customerId = await resolveStripeCustomerId({
            uid: 'uid_1',
            email: 'member@example.com',
            knownCustomerId: 'cus_test',
        });

        expect(customerId).toBe('cus_new');
        expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    });

    it('does not swallow an unexpected Stripe failure', async () => {
        (stripe.customers.retrieve as jest.Mock).mockRejectedValue(
            Object.assign(new Error('API connection error'), { statusCode: 503 }),
        );

        await expect(
            resolveStripeCustomerId({
                uid: 'uid_1',
                email: 'member@example.com',
                knownCustomerId: 'cus_alive',
            }),
        ).rejects.toThrow('API connection error');

        expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it('creates the customer when none is stored yet', async () => {
        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_fresh' });

        const customerId = await resolveStripeCustomerId({
            uid: 'uid_1',
            email: 'member@example.com',
        });

        expect(customerId).toBe('cus_fresh');
        expect(stripe.customers.retrieve).not.toHaveBeenCalled();
        expect(stripe.customers.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'member@example.com' }),
            { idempotencyKey: 'cust_uid_1' },
        );
    });

    it('creates the replacement customer under a different idempotency key', async () => {
        // Stripe replays the stored response of a key for 24 hours. Reusing
        // `cust_uid_1` would hand back the customer that was deleted.
        (stripe.customers.retrieve as jest.Mock).mockResolvedValue({ id: 'cus_gone', deleted: true });
        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_new' });

        await resolveStripeCustomerId({
            uid: 'uid_1',
            email: 'member@example.com',
            knownCustomerId: 'cus_gone',
        });

        expect(stripe.customers.create).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'member@example.com' }),
            { idempotencyKey: 'cust_uid_1_replacing_cus_gone' },
        );
    });

    it('waits for a live replacement when a concurrent request still sees the deleted pointer', async () => {
        (stripe.customers.retrieve as jest.Mock).mockImplementation(async (id: string) => ({
            id, deleted: id !== 'cus_new',
        }));
        (stripe.customers.create as jest.Mock).mockRejectedValue(
            Object.assign(new Error('in progress'), { code: 'idempotency_key_in_use' }),
        );
        getMock.mockResolvedValueOnce({ data: () => ({ customerId: 'cus_gone' }) })
            .mockResolvedValueOnce({ data: () => ({ customerId: 'cus_other_deleted' }) })
            .mockResolvedValue({ data: () => ({ customerId: 'cus_new' }) });

        await expect(resolveStripeCustomerId({
            uid: 'uid_1', email: 'member@example.com', knownCustomerId: 'cus_gone',
        })).resolves.toBe('cus_new');
        expect(getMock).toHaveBeenCalledTimes(3);
    });

    it('fails instead of returning the deleted pointer if the concurrent replacement never lands', async () => {
        (stripe.customers.retrieve as jest.Mock).mockResolvedValue({ id: 'cus_gone', deleted: true });
        (stripe.customers.create as jest.Mock).mockRejectedValue(
            Object.assign(new Error('in progress'), { code: 'idempotency_key_in_use' }),
        );
        getMock.mockResolvedValue({ data: () => ({ customerId: 'cus_gone' }) });

        await expect(resolveStripeCustomerId({
            uid: 'uid_1', email: 'member@example.com', knownCustomerId: 'cus_gone',
        })).rejects.toThrow('in progress');
    });
});
