import { proxy } from './proxy';
import { NextRequest } from 'next/server';
import { decryptSession } from './lib/session';
import { decryptAdminSession } from './lib/admin-dashboard/session';

// LAYER MOCKS 
jest.mock('./lib/session', () => ({
    decryptSession: jest.fn(),
}));

jest.mock('./lib/admin-dashboard/session', () => ({
    decryptAdminSession: jest.fn(),
}));

jest.mock('jose', () => ({
    jwtVerify: jest.fn(),
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

    describe('isolated admin access', () => {
        it('allows the dashboard and login route to render without an admin session', async () => {
            const dashboardResponse = await proxy(new NextRequest('http://localhost/admin-dashboard'));
            const loginResponse = await proxy(new NextRequest('http://localhost/api/admin/login'));

            expect(dashboardResponse.headers.get('x-middleware-next')).toBe('1');
            expect(loginResponse.headers.get('x-middleware-next')).toBe('1');
            expect(decryptAdminSession).not.toHaveBeenCalled();
            expect(decryptSession).not.toHaveBeenCalled();
        });

        it('returns JSON 401 when a protected admin API has no admin cookie', async () => {
            const response = await proxy(new NextRequest('http://localhost/api/admin/members'));

            expect(response.status).toBe(401);
            expect(await response.json()).toEqual({ error: 'Unauthorized' });
            expect(decryptSession).not.toHaveBeenCalled();
        });

        it('returns JSON 401 for an invalid admin cookie', async () => {
            (decryptAdminSession as jest.Mock).mockResolvedValue(null);
            const request = new NextRequest('http://localhost/api/admin/members');
            request.cookies.set('admin_session', 'invalid-admin-token');

            const response = await proxy(request);

            expect(response.status).toBe(401);
            expect(decryptAdminSession).toHaveBeenCalledWith('invalid-admin-token');
            expect(decryptSession).not.toHaveBeenCalled();
        });

        it('allows a protected admin API with a valid admin cookie', async () => {
            (decryptAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
            const request = new NextRequest('http://localhost/api/admin/members');
            request.cookies.set('admin_session', 'valid-admin-token');

            const response = await proxy(request);

            expect(response.headers.get('x-middleware-next')).toBe('1');
            expect(decryptSession).not.toHaveBeenCalled();
        });

        it('rejects an invalid admin cookie even when a valid member cookie is present', async () => {
            (decryptAdminSession as jest.Mock).mockResolvedValue(null);
            (decryptSession as jest.Mock).mockResolvedValue({
                uid: 'business-member',
                tier: 'business',
                subscriptionStatus: 'active',
            });
            const request = new NextRequest('http://localhost/api/admin/members');
            request.cookies.set('admin_session', 'invalid-admin-token');
            request.cookies.set('platform_session', 'valid-member-token');

            const response = await proxy(request);

            expect(response.status).toBe(401);
            expect(decryptAdminSession).toHaveBeenCalledWith('invalid-admin-token');
            expect(decryptSession).not.toHaveBeenCalled();
        });
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
