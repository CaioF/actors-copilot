jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('jose', () => ({
  SignJWT: class {
    private payload: Record<string, unknown>;
    private expires: number | string = '7d';
    constructor(payload: Record<string, unknown>) { this.payload = payload; }
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime(value: number | string) { this.expires = value; return this; }
    sign() { return Promise.resolve(JSON.stringify({ payload: this.payload, expires: this.expires })); }
  },
  jwtVerify: async (token: string) => {
    const parsed = JSON.parse(token);
    if (typeof parsed.expires === 'number' && parsed.expires <= Math.floor(Date.now() / 1000)) throw new Error('expired');
    return { payload: parsed.payload };
  },
}));
import { cookies } from 'next/headers';

describe('QA session expiration', () => {
  it('caps simulated sessions and refuses an expired token', async () => {
    process.env.JWT_SECRET_KEY = 'local-test-secret-not-used-in-production';
    const { encryptSession, decryptSession, setPlatformSession } = await import('./session');
    const payload = { uid: 'qa', email: 'qa@example.com', tier: 'economy' as const, subscriptionStatus: 'trialing' as const };
    const cookieSet = jest.fn();
    process.env.QA_SIMULATION_ENABLED = 'true';
    (cookies as jest.Mock).mockResolvedValue({ set: cookieSet });
    await setPlatformSession({ ...payload, qaExpiresAt: Date.now() + 60000 });
    expect(cookieSet.mock.calls[0][2].maxAge).toBeLessThanOrEqual(60);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const expired = await encryptSession({ ...payload, qaExpiresAt: Date.now() - 1000 });
      expect(await decryptSession(expired)).toBeNull();
      const active = await encryptSession({ ...payload, qaExpiresAt: Date.now() + 60000 });
      expect(await decryptSession(active)).not.toBeNull();
      process.env.QA_SIMULATION_ENABLED = 'false';
      expect(await decryptSession(active)).toBeNull();
    } finally { error.mockRestore(); delete process.env.QA_SIMULATION_ENABLED; }
  });
});
