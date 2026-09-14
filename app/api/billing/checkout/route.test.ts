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
    auth: { verifyIdToken: jest.fn() },
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
        expect(data.error).toBe('Unauthorized: Missing valid platform session or authentication token');
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
            metadata: { platformUserId: mockUid, firebaseUid: mockUid },
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

        // 2. Validate Stripe Session Creation parameters match strict design criteria
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_historical_888',
            client_reference_id: mockUid,
            mode: 'subscription',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            line_items: [
                {
                    price: 'price_economy_id_abc',
                    quantity: 1,
                },
            ],
            subscription_data: {
                metadata: {
                    firebaseUid: mockUid,
                    platformUserId: mockUid,
                    targetTier: 'economy',
                },
            },
            success_url: 'http://localhost:3000/api/billing/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/api/billing/cancelled',
            metadata: {
                platformUserId: mockUid,
                firebaseUid: mockUid,
                targetTier: 'economy',
                billingCycle: 'monthly',
                isTrial: 'false',
            },
        });

        // 3. Ensure no redundant customer objects get initialized during mapped flows
        expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it('configures 14-day free trial and payment_method_collection=always with business tier by default', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_business_id_xyz');

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', tier: 'free', status: 'canceled', hasUsedTrial: false }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: 'https://checkout.stripe.com/pay/trial_session_link' });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ isTrial: true }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/pay/trial_session_link');

        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                customer: 'cus_historical_888',
                client_reference_id: mockUid,
                mode: 'subscription',
                payment_method_collection: 'always',
                subscription_data: {
                    metadata: {
                        firebaseUid: mockUid,
                        platformUserId: mockUid,
                        targetTier: 'business',
                    },
                    trial_period_days: 14,
                },
                metadata: expect.objectContaining({
                    isTrial: 'true',
                    targetTier: 'business',
                }),
            })
        );
    });

    it('rejects trial requests with 400 Bad Request if the account has already redeemed a trial', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', tier: 'free', status: 'canceled', hasUsedTrial: true }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ isTrial: true }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('A free trial has already been used for this account.');
    });

    it('authenticates via idToken fallback when platform session cookie is absent', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);
        const { auth } = require('@/lib/firebase.admin');
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_business_id_xyz');

        const mockGet = jest.fn().mockResolvedValue({
            exists: false,
            data: () => null,
        });
        const mockSet = jest.fn().mockResolvedValue(true);
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet, set: mockSet });

        (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_token_123' });
        (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({ url: 'https://checkout.stripe.com/pay/idtoken_session' });

        const req = new Request('http://localhost/api/billing/checkout', {
            method: 'POST',
            body: JSON.stringify({ isTrial: true, idToken: 'valid_firebase_id_token' }),
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://checkout.stripe.com/pay/idtoken_session');
        expect(auth.verifyIdToken).toHaveBeenCalledWith('valid_firebase_id_token');
    });
});