import { POST, GET } from './route';
import { auth, db } from '@/lib/firebase.admin';
import { setPlatformSession, getPlatformSession } from '@/lib/session';
import { NextRequest } from 'next/server';

// --- STABLE DEPENDENCY MOCKS ---

jest.mock('@/lib/firebase.admin', () => ({
    auth: {
        verifyIdToken: jest.fn(),
    },
    db: {
        doc: jest.fn(),
    },
}));

jest.mock('@/lib/session', () => ({
    setPlatformSession: jest.fn(),
    getPlatformSession: jest.fn(),
}));

describe('Authentication Callback Route Handlers (Stripe & Firestore Integration)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/callback', () => {
        
        /**
         * Test suite validating robust guard behavior on missing identity parameters.
         */
        it('returns 400 Bad Request if the idToken parameter is missing from the payload', async () => {
            const req = new Request('http://localhost/api/auth/callback', {
                method: 'POST',
                body: JSON.stringify({}),
            }) as NextRequest; 

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Missing Identity ID Token');
        });

        /**
         * Test suite validating enforcement of specific claims requirements on token signatures.
         */
        it('returns 400 Bad Request if the verified token structure lacks a valid email claim', async () => {
            (auth.verifyIdToken as jest.Mock).mockResolvedValue({
                uid: 'user_123',
                // Explicitly missing email field target
            });

            const req = new Request('http://localhost/api/auth/callback', {
                method: 'POST',
                body: JSON.stringify({ idToken: 'mock_firebase_id_token' }),
            }) as NextRequest; 

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Identity Token lacks a valid email claim');
        });

        /**
         * Test suite verifying safe fallback initialization parameters for newly registered users without records.
         */
        it('defaults to free tier and canceled status if no pre-existing billing document is found in firestore', async () => {
            const mockUid = 'new_actor_999';
            const mockEmail = 'new_actor@example.com';

            (auth.verifyIdToken as jest.Mock).mockResolvedValue({
                uid: mockUid,
                email: mockEmail,
            });

            // Mock firestore reference tracking returning false for .exists check
            const mockGet = jest.fn().mockResolvedValue({
                exists: false,
                data: () => null,
            });
            (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

            const req = new Request('http://localhost/api/auth/callback', {
                method: 'POST',
                body: JSON.stringify({ idToken: 'mock_firebase_id_token' }),
            }) as NextRequest;

            const res = await POST(req);
            const data = await res.json();

            // 1. Verify endpoint processing contract
            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.user).toEqual({
                uid: mockUid,
                email: mockEmail,
                tier: 'free',
                subscriptionStatus: 'canceled',
            });

            // 2. Validate targeted document reference mapping pathing
            expect(db.doc).toHaveBeenCalledWith(`users/${mockUid}/billing/current`);

            // 3. Confirm downstream session context configuration invocation
            expect(setPlatformSession).toHaveBeenCalledWith({
                uid: mockUid,
                email: mockEmail,
                tier: 'free',
                subscriptionStatus: 'canceled',
                stripeCustomerId: undefined,
                stripeSubscriptionId: undefined,
                stripePriceId: undefined,
                currentPeriodEnd: undefined,
            });
        });

        /**
         * Test suite confirming high-performance operational pathing under existing paying tiers.
         */
        it('resolves subscription parameters correctly and commits metadata into signed cookies context on success', async () => {
            const mockUid = 'premium_actor_777';
            const mockEmail = 'premium@example.com';
            const mockBillingDocData = {
                tier: 'business',
                status: 'active',
                customerId: 'cus_stripe123',
                subscriptionId: 'sub_123456',
                priceId: 'price_premium_id',
                currentPeriodEnd: 1800000000,
            };

            (auth.verifyIdToken as jest.Mock).mockResolvedValue({
                uid: mockUid,
                email: mockEmail,
            });

            const mockGet = jest.fn().mockResolvedValue({
                exists: true,
                data: () => mockBillingDocData,
            });
            (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

            const req = new Request('http://localhost/api/auth/callback', {
                method: 'POST',
                body: JSON.stringify({ idToken: 'mock_firebase_id_token' }),
            }) as NextRequest;

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.user).toEqual({
                uid: mockUid,
                email: mockEmail,
                tier: 'business',
                subscriptionStatus: 'active',
            });

            expect(setPlatformSession).toHaveBeenCalledWith({
                uid: mockUid,
                email: mockEmail,
                tier: 'business',
                subscriptionStatus: 'active',
                stripeCustomerId: mockBillingDocData.customerId,
                stripeSubscriptionId: mockBillingDocData.subscriptionId,
                stripePriceId: mockBillingDocData.priceId,
                currentPeriodEnd: mockBillingDocData.currentPeriodEnd,
            });
        });
    });

    describe('GET /api/auth/callback', () => {
        
        /**
         * Test suite verifying blocking responses if a client hits entitlement verification without an active cookie.
         */
        it('returns 401 Unauthorized if the active platform session is null or unauthenticated', async () => {
            (getPlatformSession as jest.Mock).mockResolvedValue(null);

            const res = await GET();
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.authenticated).toBe(false);
            expect(data.tier).toBe('free');
        });

        /**
         * Test suite verifying successful runtime metadata translation to frontend hydration structures.
         */
        it('returns 200 containing explicit profile parameters if a valid signed session exists', async () => {
            const mockSessionPayload = {
                uid: 'actor_456',
                email: 'actor@example.com',
                tier: 'economy',
                subscriptionStatus: 'active',
                stripeCustomerId: 'cus_economy456',
            };

            (getPlatformSession as jest.Mock).mockResolvedValue(mockSessionPayload);

            const res = await GET();
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual({
                authenticated: true,
                tier: 'economy',
                subscriptionStatus: 'active',
                stripeCustomerId: 'cus_economy456',
            });
        });
    });
});