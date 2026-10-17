/** @jest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ByteLengthQueuingStrategy,
  CountQueuingStrategy,
  ReadableStream,
  TextDecoderStream,
  TextEncoderStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { deserialize, serialize } from 'node:v8';
import type { NextRequest } from 'next/server';
import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';

Object.assign(globalThis, {
  ByteLengthQueuingStrategy,
  CountQueuingStrategy,
  ReadableStream,
  TextDecoder,
  TextDecoderStream,
  TextEncoder,
  TextEncoderStream,
  TransformStream,
  WritableStream,
  structuredClone: <T,>(value: T): T => deserialize(serialize(value)) as T,
});

jest.mock('server-only', () => ({}), { virtual: true });

// Jest cannot transform jose v6 through pnpm's nested ESM path; keep the real
// session module under test with the same HS256 behavior at this library edge.
jest.mock('jose', () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const sign = (input: string, secret: Uint8Array) =>
    createHmac('sha256', secret).update(input).digest('base64url');

  class TestSignJWT {
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

    async sign(secret: Uint8Array) {
      const input = `${encode(this.header)}.${encode(this.payload)}`;
      return `${input}.${sign(input, secret)}`;
    }
  }

  return {
    SignJWT: TestSignJWT,
    jwtVerify: async (
      token: string,
      secret: Uint8Array,
      options: { algorithms: string[]; issuer: string; audience: string; subject: string },
    ) => {
      const [headerSegment, payloadSegment, signatureSegment, extra] = token.split('.');
      if (!headerSegment || !payloadSegment || !signatureSegment || extra) throw new Error('Malformed token');

      const input = `${headerSegment}.${payloadSegment}`;
      const actualSignature = Buffer.from(signatureSegment, 'base64url');
      const expectedSignature = Buffer.from(sign(input, secret), 'base64url');
      if (
        actualSignature.length !== expectedSignature.length
        || !timingSafeEqual(actualSignature, expectedSignature)
      ) {
        throw new Error('Invalid signature');
      }

      const header = JSON.parse(Buffer.from(headerSegment, 'base64url').toString()) as { alg?: string };
      const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString()) as Record<string, unknown>;
      if (!options.algorithms.includes(header.alg ?? '')) throw new Error('Invalid algorithm');
      if (payload.iss !== options.issuer) throw new Error('Invalid issuer');
      if (payload.aud !== options.audience) throw new Error('Invalid audience');
      if (payload.sub !== options.subject) throw new Error('Invalid subject');
      if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new Error('Expired token');
      }

      return { payload, protectedHeader: header };
    },
  };
});

interface StoredCookie {
  value: string;
  options?: Record<string, unknown>;
}

const cookieJar = new Map<string, StoredCookie>();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, { value, options });
    },
  })),
}));

jest.mock('@/lib/firebase.admin', () => ({
  db: {
    collection: jest.fn(),
  },
}));

const projections: AdminMemberProjection[] = [
  {
    uid: 'trial-member',
    email: 'trial@example.com',
    displayName: 'Trial Actor',
    tier: 'business',
    subscriptionStatus: 'trialing',
    membershipState: 'trial',
    trialStart: 1_800_000_000,
    trialEnd: 1_801_209_600,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: 'cus_trial',
    subscriptionId: 'sub_trial',
    priceId: 'price_trial',
    authCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    uid: 'paid-member',
    email: 'paid@example.com',
    displayName: 'Paid Actor',
    tier: 'economy',
    subscriptionStatus: 'active',
    membershipState: 'paid',
    trialStart: null,
    trialEnd: null,
    currentPeriodEnd: 1_803_888_000,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: 'cus_paid',
    subscriptionId: 'sub_paid',
    priceId: 'price_paid',
    authCreatedAt: '2026-01-02T00:00:00.000Z',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    uid: 'no-plan-member',
    email: 'no-plan@example.com',
    displayName: 'No Plan Actor',
    tier: 'free',
    subscriptionStatus: null,
    membershipState: 'no_plan',
    trialStart: null,
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    customerId: null,
    subscriptionId: null,
    priceId: null,
    authCreatedAt: '2026-01-03T00:00:00.000Z',
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
];

describe('admin dashboard integration flow', () => {
  const originalEnvironment = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
  };

  beforeEach(() => {
    process.env.ADMIN_USERNAME = 'integration-admin';
    process.env.ADMIN_PASSWORD = 'integration-password';
    process.env.ADMIN_JWT_SECRET = 'integration-admin-secret-distinct-from-member-secret';
    cookieJar.clear();
    cookieJar.set('platform_session', { value: 'existing-member-session' });

  });

  afterAll(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('logs in, lists trial/paid/no-plan members, and renders the three-column dashboard', async () => {
    const {
      Headers: EdgeHeaders,
      Request: EdgeRequest,
      Response: EdgeResponse,
    } = await import('next/dist/compiled/@edge-runtime/primitives');
    Object.assign(globalThis, {
      Headers: EdgeHeaders,
      Request: EdgeRequest,
      Response: EdgeResponse,
    });

    const [
      { default: AdminDashboardPage },
      { POST: login },
      { GET: listMembers },
      { ADMIN_SESSION_COOKIE_NAME },
      { db },
    ] = await Promise.all([
      import('@/app/admin-dashboard/page'),
      import('@/app/api/admin/login/route'),
      import('@/app/api/admin/members/route'),
      import('@/lib/admin-dashboard/session'),
      import('@/lib/firebase.admin'),
    ]);

    (db.collection as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({
        docs: projections.map(({ uid, ...data }) => ({
          id: uid,
          data: () => data,
        })),
      }),
    });

    const loginResponse = await login(new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost',
        'X-Forwarded-For': '198.51.100.7',
      },
      body: JSON.stringify({
        username: 'integration-admin',
        password: 'integration-password',
      }),
    }) as NextRequest);

    expect(loginResponse.status).toBe(200);
    expect(await loginResponse.json()).toEqual({ success: true });
    expect(cookieJar.get(ADMIN_SESSION_COOKIE_NAME)?.value).toEqual(expect.any(String));
    expect(cookieJar.get(ADMIN_SESSION_COOKIE_NAME)?.value).not.toBe('existing-member-session');
    expect(cookieJar.get('platform_session')?.value).toBe('existing-member-session');

    const membersResponse = await listMembers();
    expect(membersResponse.status).toBe(200);
    expect(await membersResponse.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ membershipState: 'trial' }),
      expect.objectContaining({ membershipState: 'paid' }),
      expect.objectContaining({ membershipState: 'no_plan' }),
    ]));

    render(await AdminDashboardPage());

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name',
      'Email',
      'Status',
    ]);
    expect(within(table).getByText('Trial')).toBeInTheDocument();
    expect(within(table).getByText('Paid')).toBeInTheDocument();
    expect(within(table).getByText('No plan')).toBeInTheDocument();
  });
});
