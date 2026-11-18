import type { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/admin/affiliate-qa/route';
import { POST as callback } from '@/app/api/auth/callback/route';
import { buildAffiliateReport } from '@/lib/admin-dashboard/affiliates';
import { db } from '@/lib/firebase.admin';
import { setPlatformSession } from '@/lib/session';

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__DELETE__' } }));
jest.mock('@/lib/admin-dashboard/session', () => ({ getAdminSession: jest.fn(async () => ({ sub: 'admin' })) }));
jest.mock('@/lib/admin-dashboard/sync', () => ({ syncAdminMember: jest.fn() }));
jest.mock('@/lib/verified-trial-restart', () => ({ canRestartInvalidBillingTrial: jest.fn(async () => false) }));
jest.mock('@/lib/session', () => ({ setPlatformSession: jest.fn(), getPlatformSession: jest.fn() }));
jest.mock('@/lib/affiliate-promotion-codes', () => ({ ensureAffiliatePromotionCode: jest.fn(), readPromotionCodeAffiliateCode: jest.fn(async () => 'lucas') }));
jest.mock('@/lib/stripe', () => ({ stripe: { subscriptions: { list: jest.fn() }, invoices: { list: jest.fn() } } }));
jest.mock('@/lib/firebase.admin', () => {
  const store = new Map<string, Record<string, unknown>>();
  const snapshot = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
  const ref = (path: string) => ({ path, get: async () => snapshot(path) });
  const write = (path: string, data: Record<string, unknown>, merge: boolean) => {
    const result = merge ? { ...(store.get(path) || {}) } : {};
    for (const [key, value] of Object.entries(data)) {
      if (value === '__DELETE__') delete result[key]; else result[key] = value;
    }
    store.set(path, result);
  };
  return {
    auth: { getUser: jest.fn(async () => ({ email: 'qa@example.com' })), verifyIdToken: jest.fn(async () => ({ uid: 'qa', email: 'qa@example.com' })) },
    db: {
      __clear: () => store.clear(),
      __seed: (path: string, data: Record<string, unknown>) => store.set(path, { ...data }),
      doc: ref,
      getAll: async (...refs: Array<{ path: string }>) => refs.map(item => snapshot(item.path)),
      collection: (name: string) => ({
        get: async () => ({ docs: [...store.entries()].filter(([path]) => path.startsWith(`${name}/`) && path.split('/').length === 2).map(([path, data]) => ({ id: path.split('/')[1], data: () => data })) }),
        where: (_field: string, _op: string, value: string) => ({ get: async () => ({ docs: [...store.entries()].filter(([path, data]) => path.startsWith(`${name}/`) && path.split('/').length === 2 && data.affiliateCode === value).map(([path, data]) => ({ id: path.split('/')[1], data: () => data })) }) }),
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async (item: { path: string }) => snapshot(item.path),
        set: (item: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => write(item.path, data, !!options?.merge),
        delete: (item: { path: string }) => store.delete(item.path),
      }),
    },
  };
});

const fakeDb = db as unknown as { __clear(): void; __seed(path: string, data: Record<string, unknown>): void };
const key = 'a'.repeat(64);
const runId = '550e8400-e29b-41d4-a716-446655440000';
const request = (method: 'POST' | 'DELETE', body: unknown) => new Request('https://app.example/api/admin/affiliate-qa', {
  method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
}) as NextRequest;

it('shows a simulated coupon trial separately and restores it after the test', async () => {
  process.env.QA_SIMULATION_ENABLED = 'true';
  process.env.QA_SIMULATION_SECRET = key;
  process.env.QA_SIMULATION_ALLOWED_UIDS = 'qa';
  process.env.QA_SIMULATION_ALLOWED_EMAILS = 'qa@example.com';
  process.env.QA_SIMULATION_ALLOWED_AFFILIATES = 'lucas';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  global.fetch = jest.fn(async (url: string | URL | Request) => ({ status: String(url).includes('/documents/users/') ? 200 : 403 })) as unknown as typeof fetch;
  fakeDb.__clear();
  fakeDb.__seed('users/qa', { email: 'qa@example.com' });
  fakeDb.__seed('affiliates/lucas', { name: 'Lucas', active: true, promotionCodeId: 'promo_lucas', rate: 0.3 });
  try {
    const result = await POST(request('POST', { uid: 'qa', affiliateCode: 'lucas', source: 'coupon', runId, idToken: 'synthetic' }));
    expect(result.status).toBe(200);
    const session = await callback(new Request('https://app.example/api/auth/callback', { method: 'POST', body: JSON.stringify({ idToken: 'synthetic' }) }) as NextRequest);
    expect(session.status).toBe(200);
    expect(setPlatformSession).toHaveBeenCalledWith(expect.objectContaining({ tier: 'economy', subscriptionStatus: 'trialing', qaExpiresAt: expect.any(Number) }));
    const [during] = await buildAffiliateReport();
    expect(during).toMatchObject({ referredCount: 0, qaReferredCount: 1, convertedCount: 0, totals: [] });
    expect((await DELETE(request('DELETE', { uid: 'qa', runId }))).status).toBe(200);
    const [after] = await buildAffiliateReport();
    expect(after).toMatchObject({ referredCount: 0, qaReferredCount: 0, convertedCount: 0, totals: [] });
  } finally {
    for (const name of ['QA_SIMULATION_ENABLED','QA_SIMULATION_SECRET','QA_SIMULATION_ALLOWED_UIDS','QA_SIMULATION_ALLOWED_EMAILS','QA_SIMULATION_ALLOWED_AFFILIATES']) delete process.env[name];
  }
});
