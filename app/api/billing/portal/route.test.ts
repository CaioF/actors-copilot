import { POST } from './route';
import { NextRequest } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase.admin';

// LAYER MOCKS 
jest.mock('@/lib/session', () => ({
    getPlatformSession: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
    stripe: {
        billingPortal: {
            sessions: { create: jest.fn() },
        },
    },
}));

jest.mock('@/lib/firebase.admin', () => ({
    db: { doc: jest.fn() },
}));

describe('Stripe Customer Portal Route Handler', () => {
    const mockUid = 'actor_portal_user_888';
    const mockEmail = 'actor_portal@example.com';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL = 'http://localhost:3000/dashboard';
    });

    /**
     * Test suite enforcing strict security guard boundaries at the edge gateway.
     */
    it('returns 401 Unauthorized if the active platform session is missing or null', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);

        const req = new Request('http://localhost/api/billing/portal', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Unauthorized: Missing valid platform session');
    });

    /**
     * Test suite checking edge constraints when an active user attempts a portal transition without records.
     */
    it('returns 400 Bad Request if the firestore billing profile is missing or lacks a stripeCustomerId', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        // Mock an empty billing document reference payload
        const mockGet = jest.fn().mockResolvedValue({
            exists: false,
            data: () => null,
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        const req = new Request('http://localhost/api/billing/portal', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Bad Request: No active billing profile exists for this account.');
        expect(db.doc).toHaveBeenCalledWith(`users/${mockUid}/billing/current`);
    });

    /**
     * Test suite verifying complete orchestration success parameters on established accounts.
     */
    it('generates and returns a secure Stripe Customer Portal redirect link on happy path verification', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        // Mock a healthy subscription profile inside Firestore
        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_active_portal_identity_999' }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        // Mock Stripe API response target
        (stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
            url: 'https://billing.stripe.com/p/session/fake_portal_token',
        });

        const req = new Request('http://localhost/api/billing/portal', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://billing.stripe.com/p/session/fake_portal_token');

        // Validate the SDK configuration properties match business logic rules securely
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_active_portal_identity_999',
            return_url: 'http://localhost:3000/dashboard',
        });
    });

    /**
     * Test suite validating defensive runtime fallbacks and robust 500 mapping on exception states.
     */
    it('catches execution errors and logs structured payloads while emitting a 500 error boundary', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_broken_identity' }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        // Simulate an upstream network failure inside the Stripe endpoint call
        (stripe.billingPortal.sessions.create as jest.Mock).mockRejectedValue(new Error('Stripe API Timeout Connection'));

        const req = new Request('http://localhost/api/billing/portal', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Internal Server Error during portal initialization');
    });
});