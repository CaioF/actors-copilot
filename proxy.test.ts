import { proxy } from './proxy';
import { NextRequest } from 'next/server';
import { decryptSession } from './lib/session';

// LAYER MOCKS 
jest.mock('./lib/session', () => ({
    decryptSession: jest.fn(),
}));

describe('Edge Middleware Gating Proxy Route Interceptor', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset environment variable tracking schemas perfectly
        process.env = { ...originalEnv };
        process.env.JWT_SECRET = 'secure_test_jwt_secret_key_555';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('STRIPE Engine Gating (Modern Architecture Active)', () => {
        beforeEach(() => {
            process.env.BILLING_ENGINE = 'STRIPE';
        });

        /**
         * Test verifying cross-cutting redirect behavior on unauthenticated clients.
         */
        it('redirects to /login if no valid platform_session token cookie is presented', async () => {
            const req = new NextRequest('http://localhost/acting-coach');
            // Explicitly clearing mock request cookies to trigger empty evaluations
            req.cookies.clear();

            const res = await proxy(req);

            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toBe('http://localhost/login');
        });

        /**
         * Test checking strict invalid cookie cleanup constraints at the border gate.
         */
        it('clears session tracking and forces a login redirect if the platform token verification fails', async () => {
            (decryptSession as jest.Mock).mockResolvedValue(null);

            const req = new NextRequest('http://localhost/acting-coach');
            req.cookies.set('platform_session', 'malformed_or_tampered_jwt');

            const res = await proxy(req);

            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toBe('http://localhost/login');
            // Confirm the interceptor securely appends a deletion header signature
            expect(res.cookies.get('platform_session')?.name).toBe('platform_session');
        });

        /**
         * Test confirming premium paths are correctly guarded against low tier access.
         */
         it('redirects restricted sub-paths like /acting-coach to /upgrade for economy tier accounts', async () => {
            (decryptSession as jest.Mock).mockResolvedValue({
                uid: 'user_economy_1',
                tier: 'economy',
                subscriptionStatus: 'active',
            });

            const req = new NextRequest('http://localhost/acting-coach');
            req.cookies.set('platform_session', 'valid_economy_jwt_token');

            const res = await proxy(req);

            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toBe('http://localhost/upgrade');
         });

        /**
         * Test verifying flawless next() routing continuation for fully entitled business tiers.
         */
        it('allows access and calls next() seamlessly if the session contains an active business tier entitlement', async () => {
            (decryptSession as jest.Mock).mockResolvedValue({
                uid: 'user_premium_99',
                tier: 'business',
                subscriptionStatus: 'active',
            });

            const req = new NextRequest('http://localhost/acting-coach');
            req.cookies.set('platform_session', 'valid_business_jwt_token');

            // Next.js NextResponse.next() maps an internal x-middleware-next marker header
            const res = await proxy(req);
            
            expect(res.status).toBe(200);
            expect(res.headers.get('x-middleware-next')).toBe('1');
        });

        it('allows the Stripe billing success callback route to bypass auth gating', async () => {
            const req = new NextRequest('http://localhost/api/billing/success?session_id=cs_test_123');

            const res = await proxy(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('x-middleware-next')).toBe('1');
        });
    });


});