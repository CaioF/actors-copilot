import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { setAdminSession, verifyAdminCredentials } from '@/lib/admin-dashboard/session';
import { POST } from './route';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

jest.mock('@/lib/admin-dashboard/session', () => ({
  setAdminSession: jest.fn(),
  verifyAdminCredentials: jest.fn(),
}));

function request(body: string, options: { contentType?: string; origin?: string; ip?: string } = {}): NextRequest {
  const headers = new Headers();
  if (options.contentType !== undefined) headers.set('content-type', options.contentType);
  if (options.origin) headers.set('origin', options.origin);
  if (options.ip) headers.set('x-forwarded-for', options.ip);
  return new Request('http://localhost/api/admin/login', { method: 'POST', headers, body }) as NextRequest;
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a JSON content type', async () => {
    const response = await POST(request(JSON.stringify({ username: 'admin', password: 'secret' })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request' });
    expect(verifyAdminCredentials).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and missing fields', async () => {
    const malformed = await POST(request('{', { contentType: 'application/json', ip: 'malformed' }));
    const missing = await POST(request(JSON.stringify({ username: 'admin' }), {
      contentType: 'application/json',
      ip: 'missing',
    }));

    expect(malformed.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Invalid request' });
    expect(await missing.json()).toEqual({ error: 'Invalid request' });
  });

  it('rejects a mismatched browser origin but accepts a missing origin', async () => {
    const mismatched = await POST(request(JSON.stringify({ username: 'admin', password: 'secret' }), {
      contentType: 'application/json',
      origin: 'https://attacker.example',
      ip: 'origin-rejected',
    }));
    (verifyAdminCredentials as jest.Mock).mockReturnValue(true);
    const missing = await POST(request(JSON.stringify({ username: 'admin', password: 'secret' }), {
      contentType: 'application/json; charset=utf-8',
      ip: 'origin-missing',
    }));

    expect(mismatched.status).toBe(403);
    expect(missing.status).toBe(200);
  });

  it('returns the same generic response for either incorrect credential', async () => {
    (verifyAdminCredentials as jest.Mock).mockReturnValue(false);
    const badUsername = await POST(request(JSON.stringify({ username: 'wrong', password: 'configured-password' }), {
      contentType: 'application/json',
      ip: 'wrong-username',
    }));
    const badPassword = await POST(request(JSON.stringify({ username: 'configured-admin', password: 'wrong' }), {
      contentType: 'application/json',
      ip: 'wrong-password',
    }));

    expect(badUsername.status).toBe(401);
    expect(badPassword.status).toBe(401);
    expect(await badUsername.json()).toEqual({ error: 'Invalid credentials' });
    expect(await badPassword.json()).toEqual({ error: 'Invalid credentials' });
  });

  it('sets only the server-managed admin session and returns no token', async () => {
    (verifyAdminCredentials as jest.Mock).mockReturnValue(true);

    const response = await POST(request(JSON.stringify({ username: 'configured-admin', password: 'configured-password' }), {
      contentType: 'application/json',
      origin: 'http://localhost',
      ip: 'successful-login',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(setAdminSession).toHaveBeenCalledTimes(1);
  });

  it('throttles attempts after five failures and clears failures after success', async () => {
    (verifyAdminCredentials as jest.Mock).mockReturnValue(false);
    const makeAttempt = () => POST(request(JSON.stringify({ username: 'wrong', password: 'wrong' }), {
      contentType: 'application/json',
      ip: '203.0.113.20, 10.0.0.1',
    }));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await makeAttempt()).status).toBe(401);
    }
    expect((await makeAttempt()).status).toBe(429);
    expect(verifyAdminCredentials).toHaveBeenCalledTimes(5);

    (verifyAdminCredentials as jest.Mock).mockReturnValue(true);
    const success = await POST(request(JSON.stringify({ username: 'admin', password: 'secret' }), {
      contentType: 'application/json',
      ip: 'different-ip',
    }));
    expect(success.status).toBe(200);
  });

  it('never includes submitted secrets in responses or logs', async () => {
    const submittedSecret = 'never-log-this-password';
    (verifyAdminCredentials as jest.Mock).mockImplementation(() => {
      throw new Error(submittedSecret);
    });

    const response = await POST(request(JSON.stringify({ username: 'admin', password: submittedSecret }), {
      contentType: 'application/json',
      ip: 'internal-error',
    }));
    const responseText = await response.text();
    const logText = JSON.stringify((logger.error as jest.Mock).mock.calls);

    expect(response.status).toBe(500);
    expect(responseText).not.toContain(submittedSecret);
    expect(logText).not.toContain(submittedSecret);
  });
});
