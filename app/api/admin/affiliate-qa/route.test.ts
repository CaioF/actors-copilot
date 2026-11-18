import type { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';
import { auth, db } from '@/lib/firebase.admin';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { getPlatformSession, setPlatformSession, deletePlatformSession } from '@/lib/session';
import { findAffiliateByCode } from '@/lib/admin-dashboard/affiliates';
import { stripe } from '@/lib/stripe';
import { readQaTrial } from '@/lib/qa-affiliate-run';
import { createHash } from 'node:crypto';
import type { fixtureStore } from '@/qa/affiliates/fixture-store';

jest.mock('@/lib/firebase.admin', () => ({
  auth: { getUser: jest.fn() },
  db: jest.requireActual('@/qa/affiliates/fixture-store').fixtureStore(),
}));
jest.mock('@/lib/session', () => ({
  getPlatformSession: jest.fn(),
  setPlatformSession: jest.fn(),
  deletePlatformSession: jest.fn(),
}));
jest.mock('@/lib/admin-dashboard/session', () => ({ getAdminSession: jest.fn() }));
jest.mock('@/lib/admin-dashboard/affiliates', () => ({
  ...jest.requireActual('@/lib/admin-dashboard/affiliates'),
  findAffiliateByCode: jest.fn(),
}));
jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { list: jest.fn() },
    invoices: { list: jest.fn() },
  },
}));
const store = db as unknown as ReturnType<typeof fixtureStore>;
const key = 'a'.repeat(64),
  uid = 'qa-member',
  email = 'demo@example.test',
  code = 'lucas';
const runId = '550e8400-e29b-41d4-a716-446655440000';
const checkoutId = 'cs_test_0123456789';
const buyer = { uid, email, tier: 'free', subscriptionStatus: 'canceled' };
const user = { uid, email, disabled: false, metadata: { creationTime: new Date().toISOString() } };
const checkout = {
  id: checkoutId,
  mode: 'subscription',
  status: 'open',
  customer: 'cus_qa',
  client_reference_id: uid,
  subscription: null,
  success_url: 'https://app.example/api/billing/success?session_id={CHECKOUT_SESSION_ID}',
  discounts: [{ promotion_code: 'promo_qa' }],
  metadata: {
    platformUserId: uid,
    targetTier: 'economy',
    billingCycle: 'monthly',
    isTrial: 'true',
    affiliateCode: code,
  },
};
const payload = { checkoutSessionId: checkoutId, affiliateCode: code, runId };
const original = { ...process.env };
const qaPath =
  'qaAffiliateSimulations/' +
  createHash('sha256')
    .update('affiliate-qa:' + uid)
    .digest('hex');
function request(method: string, body: unknown, token = key, origin = 'https://app.example') {
  return new Request('https://app.example/api/admin/affiliate-qa', {
    method,
    headers: { origin, 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  }) as NextRequest;
}
beforeEach(() => {
  jest.resetAllMocks();
  store.clear();
  Object.assign(process.env, {
    QA_SIMULATION_ENABLED: 'true',
    QA_SIMULATION_SECRET: key,
    QA_SIMULATION_ALLOWED_UIDS: uid,
    QA_SIMULATION_ALLOWED_EMAILS: email,
    QA_SIMULATION_ALLOWED_AFFILIATES: code,
  });
  delete process.env.QA_SIMULATION_SIGNUP_EMAIL;
  (getAdminSession as jest.Mock).mockResolvedValue({ sub: 'admin' });
  (getPlatformSession as jest.Mock).mockResolvedValue(buyer);
  (auth.getUser as jest.Mock).mockResolvedValue(user);
  (findAffiliateByCode as jest.Mock).mockResolvedValue({ code, active: true, promotionCodeId: 'promo_qa' });
  (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue(checkout);
  (stripe.subscriptions.list as jest.Mock).mockResolvedValue({ data: [], has_more: false });
  (stripe.invoices.list as jest.Mock).mockResolvedValue({ data: [], has_more: false });
  store.seed('users/' + uid, { affiliateCode: code });
  store.seed('users/' + uid + '/billing/current', { customerId: 'cus_qa', tier: 'free' });
});
afterAll(() => {
  for (const k of Object.keys(process.env).filter((k) => k.startsWith('QA_SIMULATION_')))
    delete process.env[k];
  Object.assign(process.env, original);
});
it('requires an enabled deployment, the operator session, the separate secret and the authorized buyer', async () => {
  process.env.QA_SIMULATION_ENABLED = 'false';
  expect((await POST(request('POST', payload))).status).toBe(404);
  process.env.QA_SIMULATION_ENABLED = 'true';
  expect((await POST(request('POST', payload, 'bad'))).status).toBe(404);
  expect((await POST(request('POST', payload, key, 'https://elsewhere.example'))).status).toBe(404);
  (getAdminSession as jest.Mock).mockResolvedValueOnce(null);
  expect((await POST(request('POST', payload))).status).toBe(404);
  (getPlatformSession as jest.Mock).mockResolvedValueOnce(null);
  expect((await POST(request('POST', payload))).status).toBe(403);
  (auth.getUser as jest.Mock).mockResolvedValueOnce({ ...user, email: 'other@example.test' });
  expect((await POST(request('POST', payload))).status).toBe(403);
  expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
});
it.each([
  { status: 'complete' },
  { mode: 'payment' },
  { client_reference_id: 'someone-else' },
  { customer: 'cus_other' },
  { discounts: [] },
  { success_url: 'https://another.example/done' },
  { metadata: { ...checkout.metadata, targetTier: 'business' } },
])('rejects a mismatched or undiscounted checkout %j', async (change) => {
  (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({ ...checkout, ...change });
  expect((await POST(request('POST', payload))).status).toBe(409);
  expect(store.read(qaPath)).toBeUndefined();
});
it('rejects real paid invoices and active or trialing subscriptions', async () => {
  (stripe.invoices.list as jest.Mock).mockResolvedValueOnce({
    data: [{ amount_paid: 100 }],
    has_more: false,
  });
  expect((await POST(request('POST', payload))).status).toBe(409);
  (stripe.subscriptions.list as jest.Mock).mockResolvedValueOnce({
    data: [{ status: 'trialing' }],
    has_more: false,
  });
  expect((await POST(request('POST', payload))).status).toBe(409);
  expect(setPlatformSession).not.toHaveBeenCalled();
});
it('supports one exact preapproved new signup and refuses an old or different account', async () => {
  delete process.env.QA_SIMULATION_ALLOWED_UIDS;
  process.env.QA_SIMULATION_SIGNUP_EMAIL = email;
  (auth.getUser as jest.Mock).mockResolvedValueOnce({ ...user, metadata: { creationTime: '2020-01-01' } });
  expect((await POST(request('POST', payload))).status).toBe(409);
  process.env.QA_SIMULATION_SIGNUP_EMAIL = 'someone@example.test';
  expect((await POST(request('POST', payload))).status).toBe(403);
  process.env.QA_SIMULATION_SIGNUP_EMAIL = email;
  expect((await POST(request('POST', payload))).status).toBe(200);
});
it('serves an operator form and lets the browser follow its own successful 303 return', async () => {
  const page = await GET();
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('Confirm demo trial');
  const form = (origin: string) =>
    new Request('https://app.example/api/admin/affiliate-qa', {
      method: 'POST',
      headers: { origin },
      body: new URLSearchParams({ ...payload, key }),
    }) as NextRequest;
  expect((await POST(form('https://elsewhere.example'))).status).toBe(404);
  const result = await POST(form('https://app.example'));
  expect(result.status).toBe(303);
  expect(result.headers.get('location')).toBe('/dashboard');
  (getAdminSession as jest.Mock).mockResolvedValue(null);
  expect((await GET()).status).toBe(404);
});
it('confirms the actual checkout idempotently, returns the app landing page, and cleans up only that run', async () => {
  const responses = await Promise.all([POST(request('POST', payload)), POST(request('POST', payload))]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  const first = await responses[0].json();
  expect(first).toMatchObject({ simulated: true, runId, returnPath: '/dashboard' });
  expect(await responses[1].json()).toEqual(first);
  expect(setPlatformSession).toHaveBeenCalledWith(
    expect.objectContaining({
      uid,
      tier: 'economy',
      subscriptionStatus: 'trialing',
      qaExpiresAt: first.expiresAt,
    }),
  );
  expect(store.read('users/' + uid)).toEqual({ affiliateCode: code });
  expect(store.read('users/' + uid + '/billing/current')).toEqual({ customerId: 'cus_qa', tier: 'free' });
  const other = '550e8400-e29b-41d4-a716-446655440001';
  expect((await POST(request('POST', { ...payload, runId: other }))).status).toBe(409);
  expect((await DELETE(request('DELETE', { uid, runId: other }))).status).toBe(409);
  (getPlatformSession as jest.Mock).mockResolvedValue({ ...buyer, qaExpiresAt: first.expiresAt });
  const receipt = store.read(qaPath)!;
  expect((await DELETE(request('DELETE', { uid, runId }))).status).toBe(200);
  expect(deletePlatformSession).toHaveBeenCalled();
  expect((await DELETE(request('DELETE', { uid, runId }))).status).toBe(200);
  // A deleted, authentic receipt cannot become active again in a new Firestore generation.
  store.seed(qaPath, receipt);
  expect(await readQaTrial(uid, email)).toBeNull();
});
it('recognizes manually applied discounts from Stripe and refuses an expired demo', async () => {
  (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({
    ...checkout,
    metadata: { ...checkout.metadata, affiliateCode: undefined },
  });
  expect((await POST(request('POST', payload))).status).toBe(200);
  expect((await readQaTrial(uid, email))?.source).toBe('coupon');
  const old = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(old + 20 * 60_000);
  try {
    expect(await readQaTrial(uid, email)).toBeNull();
  } finally {
    clock.mockRestore();
  }
});
