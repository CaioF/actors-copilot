import { POST } from './route';
import { NextRequest } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { db, auth } from '@/lib/firebase.admin';

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
    auth: { verifyIdToken: jest.fn() },
}));

describe('POST /api/create-portal-session', () => {
    const mockUid = 'user_portal_test_123';
    const mockEmail = 'actor_test@example.com';
    const mockCustomerId = 'cus_stripe_portal_123';

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.APP_URL;
        process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    });

    it('returns 401 Unauthorized if no platform session cookie or ID token is provided', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);

        const req = new Request('http://localhost:3000/api/create-portal-session', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toContain('Unauthorized');
    });

    it('authenticates via Firebase ID token if session cookie is missing', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: mockCustomerId }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        (stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_token',
        });

        const req = new Request('http://localhost:3000/api/create-portal-session', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer mock_id_token' },
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://billing.stripe.com/session/test_token');
        expect(auth.verifyIdToken).toHaveBeenCalledWith('mock_id_token');
    });

    it('returns 400 Bad Request if no stripeCustomerId exists in Firestore', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: false,
            data: () => null,
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        const req = new Request('http://localhost:3000/api/create-portal-session', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Bad Request: No active billing profile exists for this account.');
    });

    it('creates portal session and returns URL with settings return_url on success', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: mockCustomerId }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        (stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_portal_session',
        });

        const req = new Request('http://localhost:3000/api/create-portal-session', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.url).toBe('https://billing.stripe.com/session/test_portal_session');
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: mockCustomerId,
            return_url: 'http://localhost:3000/settings',
        });
    });

    it('returns 500 Internal Server Error when Stripe API throws an exception', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });

        const mockGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: mockCustomerId }),
        });
        (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

        (stripe.billingPortal.sessions.create as jest.Mock).mockRejectedValue(new Error('Stripe API error'));

        const req = new Request('http://localhost:3000/api/create-portal-session', {
            method: 'POST',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Internal Server Error during portal initialization');
    });
});
