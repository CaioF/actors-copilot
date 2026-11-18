import type { NextRequest } from 'next/server';
import { POST, DELETE } from './route';
import { auth, db } from '@/lib/firebase.admin';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { findAffiliateByCode } from '@/lib/admin-dashboard/affiliates';
import { readPromotionCodeAffiliateCode } from '@/lib/affiliate-promotion-codes';
import { stripe } from '@/lib/stripe';

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__DELETE__' } }));
jest.mock('@/lib/admin-dashboard/session', () => ({ getAdminSession: jest.fn() }));
jest.mock('@/lib/admin-dashboard/affiliates', () => ({ findAffiliateByCode: jest.fn() }));
jest.mock('@/lib/affiliate-promotion-codes', () => ({ readPromotionCodeAffiliateCode: jest.fn() }));
jest.mock('@/lib/admin-dashboard/sync', () => ({ syncAdminMember: jest.fn() }));
jest.mock('@/lib/stripe', () => ({ stripe: { subscriptions: { list: jest.fn() }, invoices: { list: jest.fn() } } }));
jest.mock('@/lib/firebase.admin', () => {
  const store = new Map<string, Record<string, unknown>>();
  const snap = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
  const write = (path: string, data: Record<string, unknown>, merge: boolean) => {
    const value = merge ? { ...(store.get(path) || {}) } : {};
    for (const [key, field] of Object.entries(data)) {
      if (field === '__DELETE__') delete value[key];
      else value[key] = field;
    }
    store.set(path, value);
  };
  return {
    auth: { getUser: jest.fn(), verifyIdToken: jest.fn() },
    db: {
      __clear: () => store.clear(),
      __seed: (path: string, data: Record<string, unknown>) => store.set(path, { ...data }),
      __remove: (path: string) => store.delete(path),
      __read: (path: string) => store.get(path),
      doc: (path: string) => ({ path, get: async () => snap(path) }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async (ref: { path: string }) => snap(ref.path),
        set: (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => write(ref.path, data, !!options?.merge),
        update: (ref: { path: string }, data: Record<string, unknown>) => write(ref.path, data, true),
        delete: (ref: { path: string }) => store.delete(ref.path),
      }),
    },
  };
});

const fakeDb = db as unknown as { __clear(): void; __seed(path: string, value: Record<string, unknown>): void; __remove(path: string): void; __read(path: string): Record<string, unknown> | undefined };
const key = 'a'.repeat(64);
const uid = 'test-user';
const root = `users/${uid}`;
const billing = `${root}/billing/current`;
const originalEnv = { ...process.env };
const makeRequest = (method: 'POST' | 'DELETE', body: unknown, token = key) => new Request('https://app.example/api/admin/affiliate-qa', {
  method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
}) as NextRequest;
const trial = { uid, affiliateCode: 'lucas', source: 'link', runId: '550e8400-e29b-41d4-a716-446655440000', idToken: 'test-token' };

beforeEach(() => {
  jest.clearAllMocks();
  fakeDb.__clear();
  process.env.QA_SIMULATION_ENABLED = 'true';
  process.env.QA_SIMULATION_SECRET = key;
  process.env.QA_SIMULATION_ALLOWED_UIDS = uid;
  process.env.QA_SIMULATION_ALLOWED_EMAILS = 'test@example.com';
  process.env.QA_SIMULATION_ALLOWED_AFFILIATES = 'lucas';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
  (auth.getUser as jest.Mock).mockResolvedValue({ email: 'test@example.com' });
  (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid });
  global.fetch = jest.fn(async (url: string | URL | Request) => ({ status: String(url).includes('/documents/users/') ? 200 : 403 })) as unknown as typeof fetch;
  (findAffiliateByCode as jest.Mock).mockResolvedValue({ code: 'lucas', promotionCodeId: 'promo_lucas' });
  (readPromotionCodeAffiliateCode as jest.Mock).mockResolvedValue('lucas');
  (stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [], has_more: false });
  (stripe.invoices.list as jest.Mock).mockResolvedValue({ data: [], has_more: false });
  fakeDb.__seed(root, { email: 'test@example.com', subscriptionStatus: 'canceled', custom: 'preserve' });
  fakeDb.__seed(billing, { status: 'canceled', tier: 'free', customerId: 'cus_existing', custom: 'preserve' });
});
afterAll(() => { process.env = originalEnv; });

it('fails closed when disabled, missing admin, or the separate key is wrong', async () => {
  process.env.QA_SIMULATION_ENABLED = 'false';
  expect((await POST(makeRequest('POST', trial))).status).toBe(404);
  process.env.QA_SIMULATION_ENABLED = 'true';
  (getAdminSession as jest.Mock).mockResolvedValueOnce(null);
  expect((await POST(makeRequest('POST', trial))).status).toBe(404);
  expect((await POST(makeRequest('POST', trial, 'b'.repeat(64)))).status).toBe(404);
  expect(fakeDb.__read(billing)?.status).toBe('canceled');
});

it('rejects cross-origin browser requests and non-JSON payloads', async () => {
  const crossOrigin = new Request('https://app.example/api/admin/affiliate-qa', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', origin: 'https://other.example' }, body: JSON.stringify(trial) }) as NextRequest;
  const text = new Request('https://app.example/api/admin/affiliate-qa', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'text/plain' }, body: JSON.stringify(trial) }) as NextRequest;
  expect((await POST(crossOrigin)).status).toBe(404);
  expect((await POST(text)).status).toBe(404);
});

it('requires an allowlisted UID, verified matching email, affiliate and coupon ownership', async () => {
  expect((await POST(makeRequest('POST', { ...trial, uid: 'other' }))).status).toBe(400);
  (auth.getUser as jest.Mock).mockResolvedValueOnce({ email: 'other@example.com' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(400);
  expect((await POST(makeRequest('POST', { ...trial, affiliateCode: 'other' }))).status).toBe(400);
  (readPromotionCodeAffiliateCode as jest.Mock).mockResolvedValueOnce(null);
  expect((await POST(makeRequest('POST', { ...trial, source: 'coupon' }))).status).toBe(400);
  expect(fakeDb.__read(billing)?.status).toBe('canceled');
});

it('refuses to simulate when the test identity or effective Firestore rules are unsafe', async () => {
  (auth.verifyIdToken as jest.Mock).mockResolvedValueOnce({ uid: 'other' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(400);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 403 });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 200 });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 404 });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 403 }).mockResolvedValueOnce({ status: 403 }).mockResolvedValueOnce({ status: 409 });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  expect(fakeDb.__read(billing)?.status).toBe('canceled');
});

it('rejects real access, existing subscriptions, and competing attribution', async () => {
  fakeDb.__seed(billing, { status: 'active' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  fakeDb.__seed(billing, { status: 'canceled', subscriptionId: 'sub_real' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  fakeDb.__seed(billing, { status: 'canceled' });
  fakeDb.__seed(root, { affiliateCode: 'another' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
});

it('rejects a real Stripe subscription or a paid invoice even if Firestore is stale', async () => {
  (stripe.subscriptions.list as jest.Mock).mockResolvedValueOnce({ data: [{ status: 'trialing' }], has_more: false });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  (stripe.invoices.list as jest.Mock).mockResolvedValueOnce({ data: [{ amount_paid: 100 }], has_more: false });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  expect(fakeDb.__read(billing)?.status).toBe('canceled');
});

it('marks a simulated trial, prevents replay, and restores only its own changes', async () => {
  const result = await POST(makeRequest('POST', { ...trial, source: 'coupon' }));
  expect(result.status).toBe(200);
  const { runId, simulated } = await result.json();
  expect(simulated).toBe(true);
  expect(fakeDb.__read(root)).toMatchObject({ affiliateCode: 'lucas', hasAccess: true, qaSimulation: { active: true, source: 'coupon' } });
  expect(fakeDb.__read(billing)).toMatchObject({ status: 'trialing', tier: 'economy', customerId: 'cus_existing' });
  expect((await POST(makeRequest('POST', trial))).status).toBe(409);
  expect((await DELETE(makeRequest('DELETE', { uid, runId }))).status).toBe(200);
  expect(fakeDb.__read(root)).toEqual({ email: 'test@example.com', subscriptionStatus: 'canceled', custom: 'preserve' });
  expect(fakeDb.__read(billing)).toEqual({ status: 'canceled', tier: 'free', customerId: 'cus_existing', custom: 'preserve' });
});

it('refuses cleanup if billing changed after the simulation', async () => {
  const { runId } = await (await POST(makeRequest('POST', trial))).json();
  fakeDb.__seed(billing, { ...fakeDb.__read(billing), updatedAt: 'changed-by-real-event', subscriptionId: 'sub_real' });
  expect((await DELETE(makeRequest('DELETE', { uid, runId }))).status).toBe(409);
  expect(fakeDb.__read(billing)?.subscriptionId).toBe('sub_real');
});

it('removes a newly created billing document on cleanup and refuses a tampered snapshot', async () => {
  fakeDb.__remove(billing);
  const { runId } = await (await POST(makeRequest('POST', trial))).json();
  const runPath = `qaAffiliateSimulations/${uid}`;
  const original = fakeDb.__read(runPath)!;
  fakeDb.__seed(runPath, { ...original, billingExisted: true });
  expect((await DELETE(makeRequest('DELETE', { uid, runId }))).status).toBe(409);
  fakeDb.__seed(runPath, original);
  expect((await DELETE(makeRequest('DELETE', { uid, runId }))).status).toBe(200);
  expect(fakeDb.__read(billing)).toBeUndefined();
});
