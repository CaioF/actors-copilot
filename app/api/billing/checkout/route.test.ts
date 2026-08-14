import { POST } from './route';
import { NextRequest } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';
import { getStripePriceIdForTier } from '@/lib/billing';

// LAYER MOCKS 
jest.mock('@/lib/session', () => ({
    getPlatformSession: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
    stripe: {
        customers: { create: jest.fn() },
        checkout: { sessions: { create: jest.fn() } },
    },
}));

jest.mock('@/lib/firebase.admin', () => ({
    db: { doc: jest.fn() },
}));

jest.mock('@/lib/billing', () => ({
    getStripePriceIdForTier: jest.fn(),
}));

describe('Stripe Subscription Checkout Route Handler', () => {
    const mockUid = 'actor_stripe_test_123';
    const mockEmail = 'actor_billing@example.com';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL = 'http://localhost:3000/dashboard';
    });

    /**
     * Test suite enforcing strict security guard boundaries at the edge gateway.
     */
    it('returns 401 Unauthorized if the platform session is missing or invalid', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier: 'business' }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Unauthorized: Missing valid platform session');
    });

    /**
     * Test suite enforcing type and content structure assertions against payload parameters.
     */
    it('returns 400 Bad Request if the target subscription tier parameter is missing or invalid', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier: 'invalid_premium_tier' }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Invalid or unsupported subscription tier specified');
    });

    /**
     * Test suite verifying lazy customer creation and mapping when no historical customerId exists.
     */
    it('creates a new Stripe Customer and seeds initial persistence records if stripeCustomerId is unmapped', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_business_id_xyz');

        // 1. Mock a completely empty billing document check to force lazy loading
        const mockGet = jest.fn().mockResolvedValue({
            exists: false,
            data: () => null,
        });
        const mockSet = jest.fn().mockResolvedValue(true);
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet, set: mockSet });

        // 2. Mock downstream stripe SDK triggers 
        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_newly_minted_111' });
        (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: 'https://checkout.stripe.com/pay/fake_session' });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier: 'business' }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/pay/fake_session');

        // 3. Confirm Stripe API arguments match user criteria safely [cite: 91]
        expect(stripe.customers.create).toHaveBeenCalledWith({
            email: mockEmail,
            metadata: { platformUserId: mockUid },
        });

        // 4. Verify baseline structural bindings flush down safely to Firestore
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cus_newly_minted_111',
                tier: 'free',
                status: 'canceled',
            }),
            { merge: true }
        );
    });

    /**
     * Test suite verifying structural parameter configurations on successful existing workflows[cite: 91].
     */
    it('resolves checkout variables and returns an explicit redirection URL on happy path execution', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_economy_id_abc');

        // 1. Mock established payment credentials inside Firestore
        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', tier: 'free', status: 'canceled' }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: 'https://checkout.stripe.com/pay/active_session_link' });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ tier: 'economy' }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/pay/active_session_link');

        // 2. Validate Stripe Session Creation parameters match strict design criteria [cite: 36, 91]
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_historical_888',
            client_reference_id: mockUid,
            mode: 'subscription',
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {
                    price: 'price_economy_id_abc',
                    quantity: 1,
                },
            ],
            success_url: 'http://localhost:3000/api/billing/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/api/billing/cancelled',
            metadata: {
                platformUserId: mockUid,
                targetTier: 'economy',
                billingCycle: 'monthly',
            },
        });

        // 3. Ensure no redundant customer objects get initialized during mapped flows
        expect(stripe.customers.create).not.toHaveBeenCalled();
    });
});