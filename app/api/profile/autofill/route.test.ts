import { POST } from './route';
import { auth, db } from '@/lib/firebase.admin';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

// --- DEPENDENCY MOCKS ---

jest.mock('@/lib/firebase.admin', () => ({
    auth: { verifyIdToken: jest.fn() },
    db: {
        doc: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ 
                exists: false,
                data: () => undefined,
            })),
        })),
    },
}));

jest.mock('@/lib/firebase', () => ({
    getDb: jest.fn(),
    getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
}));

jest.mock('firebase/ai', () => ({
    getAI: jest.fn(() => ({})),
    getGenerativeModel: jest.fn(() => ({
        generateContent: jest.fn(() => ({
            response: {
                text: jest.fn(() => JSON.stringify({
                    fullName: 'Test Actor',
                    slug: 'test-actor',
                    headshot: 'https://example.com/photo.jpg',
                    bio: 'Test bio',
                    height: "5'9\"",
                    location: 'United States',
                    credits: [],
                    showreels: [],
                    additionalPhotos: [
                        'https://example.com/photo2.jpg',
                        'https://example.com/photo3.jpg',
                    ],
                })),
            },
        })),
    })),
    VertexAIBackend: jest.fn(),
}));

global.fetch = jest.fn();

describe('POST /api/profile/autofill', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.FIRECRAWL_API_KEY = 'fc-test-key';
    });

    /**
     * TEST SUITE 1: Authentication
     */
    describe('Authentication', () => {
        it('returns 401 when Authorization header is missing', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('returns 401 when token is invalid', async () => {
            (auth.verifyIdToken as jest.Mock).mockRejectedValueOnce(new Error('Invalid token'));

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer invalid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('returns 401 when token is malformed', async () => {
            (auth.verifyIdToken as jest.Mock).mockRejectedValueOnce(new Error('Malformed token'));

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer malformed',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(401);
        });
    });

    /**
     * TEST SUITE 2: Input Validation
     */
    describe('Input Validation', () => {
        beforeEach(() => {
            (auth.verifyIdToken as jest.Mock).mockResolvedValueOnce({ uid: 'user123' });
        });

        it('returns 400 when body is missing', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Request body is required');
        });

        it('returns 400 when url is missing from body', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({}),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('URL is required');
        });

        it('returns 400 when url is empty string', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: '' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('URL is required');
        });

        it('returns 400 when url is not a valid IMDB URL', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.google.com/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('URL must be from imdb.com');
        });

        it('returns 400 when url does not have /name/nm pattern', async () => {
            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/title/tt1234567/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toBe('Invalid IMDB URL format. Must match pattern: /name/nm\\d+');
        });

        it('accepts valid IMDB profile URL with trailing slash', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test Actor' } }),
            });
            (getDb as jest.Mock).mockReturnValue({});
            (doc as jest.Mock).mockReturnValue('mock-doc-ref');
            (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            // Should not be 400 for validation
            expect(res.status).not.toBe(400);
        });

        it('accepts valid IMDB profile URL without trailing slash', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test Actor' } }),
            });
            (getDb as jest.Mock).mockReturnValue({});
            (doc as jest.Mock).mockReturnValue('mock-doc-ref');
            (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058' }),
            });

            const res = await POST(req);
            // Should not be 400 for validation
            expect(res.status).not.toBe(400);
        });
    });

    /**
     * TEST SUITE 3: Firecrawl API Integration
     */
    describe('Firecrawl API Integration', () => {
        beforeEach(() => {
            (auth.verifyIdToken as jest.Mock).mockResolvedValueOnce({ uid: 'user123' });
        });

        it('calls Firecrawl API with correct parameters', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Tracey Collis' } }),
            });
            (getDb as jest.Mock).mockReturnValue({});
            (doc as jest.Mock).mockReturnValue('mock-doc-ref');
            (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            await POST(req);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.firecrawl.dev/v2/scrape',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer fc-test-key',
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });

        it('passes the IMDB URL in the request body to Firecrawl', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test' } }),
            });
            (getDb as jest.Mock).mockReturnValue({});
            (doc as jest.Mock).mockReturnValue('mock-doc-ref');
            (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            await POST(req);

            const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);
            expect(requestBody.url).toBe('https://www.imdb.com/name/nm2415058/');
        });

        it('requests markdown format from Firecrawl', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test' } }),
            });
            (getDb as jest.Mock).mockReturnValue({});
            (doc as jest.Mock).mockReturnValue('mock-doc-ref');
            (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            await POST(req);

            const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);
            expect(requestBody.formats).toEqual(['markdown']);
        });

        it('returns 502 when Firecrawl API returns not ok', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);

            expect(res.status).toBe(502);
            const data = await res.json();
            expect(data.error).toBe('Failed to fetch data from IMDB');
        });

        it('returns 502 when Firecrawl returns success: false', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: false, error: 'Rate limited' }),
            });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);

            expect(res.status).toBe(502);
            const data = await res.json();
            expect(data.error).toBe('Failed to fetch data from IMDB');
        });

        it('returns 500 when Firecrawl API throws error', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);

            expect(res.status).toBe(500);
        });
    });

    /**
     * TEST SUITE 4: DNA Profile Fetch
     */
    describe('DNA Profile Fetch', () => {
        beforeEach(() => {
            (auth.verifyIdToken as jest.Mock).mockResolvedValueOnce({ uid: 'user123', email: 'actor@example.com' });
        });

        it('fetches DNA profile from Firestore', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test' } }),
            });
            
            const mockGet = jest.fn().mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    psychology: { traits: ['creative', 'empathetic'] },
                    acting_fuel: { archetypes: ['The Rebel'] },
                }),
            });
            (db.doc as jest.Mock).mockReturnValue({ get: mockGet });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            await POST(req);

            // Verify db.doc was called with correct path
            expect(db.doc).toHaveBeenCalledWith('users/user123_Actor/profile/master');
            expect(mockGet).toHaveBeenCalled();
        });

        it('handles missing DNA profile gracefully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, data: { markdown: '# Test' } }),
            });
            (db.doc as jest.Mock).mockReturnValue({ get: jest.fn().mockResolvedValueOnce({ exists: false, data: () => undefined }) });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            // Should not error, just continue without DNA data
            expect(res.status).not.toBe(500);
        });
    });

    /**
     * TEST SUITE 5: Success Response
     */
    describe('Success Response', () => {
        beforeEach(() => {
            (auth.verifyIdToken as jest.Mock).mockResolvedValueOnce({ uid: 'user123', email: 'actor@example.com' });
        });

        it('returns 200 with success true on complete success', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        markdown: '# Tracey Collis\n\nActress\n\nBorn July 5, 1961',
                        metadata: {
                            title: 'Tracey Collis - IMDb',
                        }
                    }
                }),
            });
            (db.doc as jest.Mock).mockReturnValue({ get: jest.fn().mockResolvedValueOnce({ exists: false, data: () => undefined }) });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('returns data object with Partial<ActorProfile> shape', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        markdown: '# Tracey Collis\n\nActress',
                        metadata: { title: 'Tracey Collis - IMDb' }
                    }
                }),
            });
            (db.doc as jest.Mock).mockReturnValue({ get: jest.fn().mockResolvedValueOnce({ exists: false, data: () => undefined }) });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(typeof data.data).toBe('object');
        });

        it('returns additionalPhotos from AI response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        markdown: '# Tracey Collis\n\nActress',
                        metadata: { title: 'Tracey Collis - IMDb' }
                    }
                }),
            });
            (db.doc as jest.Mock).mockReturnValue({ get: jest.fn().mockResolvedValueOnce({ exists: false, data: () => undefined }) });

            const req = new Request('http://localhost/api/profile/autofill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid-token',
                },
                body: JSON.stringify({ url: 'https://www.imdb.com/name/nm2415058/' }),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.additionalPhotos).toBeDefined();
            expect(Array.isArray(data.data.additionalPhotos)).toBe(true);
            expect(data.data.additionalPhotos).toHaveLength(2);
            expect(data.data.additionalPhotos).toEqual([
                'https://example.com/photo2.jpg',
                'https://example.com/photo3.jpg',
            ]);
        });
    });
});
