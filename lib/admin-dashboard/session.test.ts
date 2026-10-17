import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  decryptAdminSession,
  deleteAdminSession,
  encryptAdminSession,
  getAdminSession,
  setAdminSession,
  verifyAdminCredentials,
} from './session';

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('jose', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');

  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const sign = (input: string, secret: Uint8Array) =>
    crypto.createHmac('sha256', secret).update(input).digest('base64url');

  class MockSignJWT {
    private header: Record<string, unknown> = {};
    private payload: Record<string, unknown>;

    constructor(payload: Record<string, unknown>) {
      this.payload = { ...payload };
    }

    setProtectedHeader(header: Record<string, unknown>) {
      this.header = header;
      return this;
    }

    setSubject(sub: string) {
      this.payload.sub = sub;
      return this;
    }

    setIssuer(iss: string) {
      this.payload.iss = iss;
      return this;
    }

    setAudience(aud: string) {
      this.payload.aud = aud;
      return this;
    }

    setIssuedAt() {
      this.payload.iat = Math.floor(Date.now() / 1000);
      return this;
    }

    setExpirationTime(value: string) {
      if (value !== '2h') throw new Error('Unexpected expiration');
      this.payload.exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
      return this;
    }

    async signToken(secret: Uint8Array) {
      const input = `${encode(this.header)}.${encode(this.payload)}`;
      return `${input}.${sign(input, secret)}`;
    }

    sign(secret: Uint8Array) {
      return this.signToken(secret);
    }
  }

  const jwtVerify = jest.fn(async (
    token: string,
    secret: Uint8Array,
    options: { algorithms: string[]; issuer: string; audience: string; subject: string },
  ) => {
    const [headerSegment, payloadSegment, signatureSegment, extra] = token.split('.');
    if (!headerSegment || !payloadSegment || !signatureSegment || extra) throw new Error('Malformed token');

    const input = `${headerSegment}.${payloadSegment}`;
    const actualSignature = Buffer.from(signatureSegment, 'base64url');
    const expectedSignature = Buffer.from(sign(input, secret), 'base64url');
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
      throw new Error('Invalid signature');
    }

    const header = JSON.parse(Buffer.from(headerSegment, 'base64url').toString()) as { alg?: string };
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString()) as Record<string, unknown>;
    if (!options.algorithms.includes(header.alg ?? '')) throw new Error('Invalid algorithm');
    if (payload.iss !== options.issuer) throw new Error('Invalid issuer');
    if (payload.aud !== options.audience) throw new Error('Invalid audience');
    if (payload.sub !== options.subject) throw new Error('Invalid subject');
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired');

    return { payload, protectedHeader: header };
  });

  return { SignJWT: MockSignJWT, jwtVerify };
});

describe('Admin Session', () => {
  const originalEnv = process.env;
  const cookieStore = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00.000Z'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      ADMIN_USERNAME: 'fixed-admin',
      ADMIN_PASSWORD: 'fixed-password',
      ADMIN_JWT_SECRET: 'a-distinct-admin-session-secret',
    };
    (cookies as jest.Mock).mockResolvedValue(cookieStore);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('checks the configured credential pair using fixed-length digests', () => {
    expect(verifyAdminCredentials('fixed-admin', 'fixed-password')).toBe(true);
    expect(verifyAdminCredentials('wrong', 'fixed-password')).toBe(false);
    expect(verifyAdminCredentials('fixed-admin', 'wrong')).toBe(false);
  });

  it('loads credentials lazily', () => {
    delete process.env.ADMIN_USERNAME;
    expect(() => verifyAdminCredentials('fixed-admin', 'fixed-password')).toThrow('ADMIN_USERNAME is not configured');
  });

  it('issues and accepts only the pinned admin claims and two-hour expiry', async () => {
    const token = await encryptAdminSession();
    const claims = await decryptAdminSession(token);

    expect(claims).toEqual(expect.objectContaining({
      sub: 'admin',
      iss: 'actors-copilot-admin',
      aud: 'admin-dashboard',
      iat: 1792238400,
      exp: 1792245600,
    }));
  });

  it.each([
    ['member subject', { sub: 'member' }],
    ['wrong issuer', { iss: 'actors-copilot' }],
    ['wrong audience', { aud: 'member-dashboard' }],
    ['expired token', { exp: 1792238399 }],
  ])('rejects a token with %s', async (_label, overrides) => {
    const valid = await encryptAdminSession();
    const [header, payload, signature] = valid.split('.');
    const changedPayload = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
      ...overrides,
    })).toString('base64url');
    const input = `${header}.${changedPayload}`;
    const changedSignature = createHmac('sha256', process.env.ADMIN_JWT_SECRET!).update(input).digest('base64url');

    expect(await decryptAdminSession(`${input}.${changedSignature}`)).toBeNull();
    expect(signature).toBeDefined();
  });

  it('rejects a token signed with an unapproved algorithm', async () => {
    const valid = await encryptAdminSession();
    const [, payload] = valid.split('.');
    const header = Buffer.from(JSON.stringify({ alg: 'HS512' })).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = createHmac('sha256', process.env.ADMIN_JWT_SECRET!).update(input).digest('base64url');

    expect(await decryptAdminSession(`${input}.${signature}`)).toBeNull();
  });

  it('rejects deterministic signature-byte tampering', async () => {
    const valid = await encryptAdminSession();
    const segments = valid.split('.');
    const signatureBytes = Buffer.from(segments[2], 'base64url');
    signatureBytes[0] ^= 0xff;
    segments[2] = signatureBytes.toString('base64url');

    expect(await decryptAdminSession(segments.join('.'))).toBeNull();
  });

  it('sets only the isolated admin cookie with the required attributes', async () => {
    await setAdminSession();

    expect(cookieStore.set).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      expect.any(String),
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE,
      },
    );
  });

  it('reads the admin cookie and ignores an absent cookie', async () => {
    cookieStore.get.mockReturnValueOnce(undefined);
    expect(await getAdminSession()).toBeNull();

    const token = await encryptAdminSession();
    cookieStore.get.mockReturnValueOnce({ value: token });
    expect(await getAdminSession()).toEqual(expect.objectContaining({ sub: 'admin' }));
    expect(cookieStore.get).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE_NAME);
  });

  it('expires only the admin cookie at its original path', async () => {
    await deleteAdminSession();

    expect(cookieStore.set).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  });
});
