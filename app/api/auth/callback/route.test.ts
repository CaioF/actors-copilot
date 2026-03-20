import { POST } from './route';
import { auth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';

// --- DEPENDENCY MOCKS ---

jest.mock('@/lib/firebase-admin', () => ({
    auth: { verifyIdToken: jest.fn() },
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn(),
}));

jest.mock('jose', () => ({
    SignJWT: jest.fn().mockImplementation(() => ({
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockReturnThis(),
        sign: jest.fn().mockResolvedValue('fake_signed_jwt_token'),
    })),
}));

global.fetch = jest.fn();

describe('Authentication POST Route (Kajabi Verification)', () => {
    let mockCookieSet: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default healthy environment variables
        process.env.JWT_SECRET = 'test_secret_key_123';
        process.env.KAJABI_CLIENT_ID = 'test_client';
        process.env.KAJABI_CLIENT_SECRET = 'test_secret';
        process.env.KAJABI_REQUIRED_OFFER_ID = '12345';

        // Setup mock cookie store
        mockCookieSet = jest.fn();
        (cookies as jest.Mock).mockResolvedValue({ set: mockCookieSet });
    });

    /**
     * TEST SUITE 1: Basic Input Validation
     */
    it('returns 401 Unauthorized if the Authorization header is missing', async () => {
        const req = new Request('http://localhost/api/auth/callback', { method: 'POST' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Token not found or invalid');
    });

    /**
     * TEST SUITE 2: System Configuration Failures
     */
    it('returns 403 if Kajabi environment variables are missing', async () => {
        delete process.env.KAJABI_CLIENT_ID;
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ email: 'actor@example.com' });

        const req = new Request('http://localhost/api/auth/callback', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer valid-firebase-token' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toBe('System configuration error. Please contact support.');
    });

    it('returns 500 if JWT_SECRET is missing during session creation', async () => {
        delete process.env.JWT_SECRET;
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ email: 'actor@example.com' });

        // Mock a fully successful Kajabi flow
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'k_token' }) }) // 1. Token
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', attributes: { email: 'actor@example.com' }, relationships: { offers: { links: { self: 'offers_url' } } } }] }) }) // 2. User
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '12345' }] }) }); // 3. Offers

        const req = new Request('http://localhost/api/auth/callback', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer valid-firebase-token' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Internal Configuration Error');
    });

    /**
     * TEST SUITE 3: Kajabi Business Logic & Rejections
     */
    it('returns 403 if the user exists but does not have the required offer', async () => {
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ email: 'actor@example.com' });

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'k_token' }) }) // 1. Token
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', attributes: { email: 'actor@example.com' }, relationships: { offers: { links: { self: 'offers_url' } } } }] }) }) // 2. User
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'WRONG_OFFER_999' }] }) }); // 3. Offers (Missing 12345)

        const req = new Request('http://localhost/api/auth/callback', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer valid-firebase-token' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toBe("You don't have the required 'The Actor's Copilot' offer. Please check your purchase history.");
    });

    /**
     * TEST SUITE 4: The Happy Path (Complete Success)
     */
    it('returns 200, signs JWT, and sets HTTP-only cookie on complete success', async () => {
        (auth.verifyIdToken as jest.Mock).mockResolvedValue({ email: 'actor@example.com' });

        // Mock the exact sequence of successful Kajabi API calls
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'k_token' }) }) // 1. Token
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', attributes: { email: 'actor@example.com' }, relationships: { offers: { links: { self: 'offers_url' } } } }] }) }) // 2. User
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '12345' }] }) }); // 3. Offers

        const req = new Request('http://localhost/api/auth/callback', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer valid-firebase-token' }),
        });

        const res = await POST(req);
        const data = await res.json();

        // 1. Check response status and payload
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.redirectUrl).toBe('/dashboard');

        // 2. Verify the cookie was actually set with the correct security parameters
        expect(mockCookieSet).toHaveBeenCalledWith(
            'kajabi_session',
            'fake_signed_jwt_token',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'strict',
                path: '/',
            })
        );
    });
});