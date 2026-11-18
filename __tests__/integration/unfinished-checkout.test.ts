import { NextRequest } from 'next/server';
import { GET as hydrate, POST as signIn } from '@/app/api/auth/callback/route';
import { GET as cancelReturn } from '@/app/api/billing/cancelled/route';
import { POST as recovery } from '@/app/api/billing/recovery/route';
import { POST as webhook } from '@/app/api/webhooks/stripe/route';
import { listAdminMemberSnapshot } from '@/lib/admin-dashboard/members';
import { auth, db } from '@/lib/firebase.admin';
import type { PlatformSession } from '@/lib/session';
import { getPlatformSession, setPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import type { fixtureStore } from '@/qa/affiliates/fixture-store';

jest.mock('@/lib/firebase.admin', () => ({
  auth: { verifyIdToken: jest.fn(), listUsers: jest.fn() },
  db: jest.requireActual('@/qa/affiliates/fixture-store').fixtureStore(),
}));
jest.mock('@/lib/session', () => ({ getPlatformSession: jest.fn(), setPlatformSession: jest.fn() }));
jest.mock('@/lib/admin-dashboard/sync', () => ({ syncAdminMember: jest.fn() }));
jest.mock('@/lib/billing-currency', () => ({ getPriceCurrencies: async () => ['usd', 'eur'] }));
jest.mock('@/lib/billing', () => ({
  getStripePriceIdForTier: () => 'price_economy_annual',
  mapStripePriceToTier: () => 'economy',
  verifyStripeWebhookEvent: (body: string) => JSON.parse(body),
}));
jest.mock('@/lib/stripe', () => ({ stripe: {
  customers: { create: jest.fn(), retrieve: jest.fn() },
  checkout: { sessions: { list: jest.fn(), create: jest.fn() } },
} }));

const store = db as unknown as ReturnType<typeof fixtureStore>;
const origin = 'https://app.theactorscopilot.com';
const actor = { uid: 'first-actor', email: 'first@example.test' };
const userPath = 'users/' + actor.uid;
const billingPath = userPath + '/billing/current';
const selection = { tier: 'economy', billingCycle: 'annual', currency: 'eur' };
const req = (path: string, body?: unknown) => new NextRequest(origin + path, {
  method: 'POST', headers: { 'content-type': 'application/json', host: 'app.theactorscopilot.com' },
  body: JSON.stringify(body ?? {}),
});
const recover = async (body?: unknown) => (await recovery(req('/api/billing/recovery', body))).json();
const admin = async () => (await listAdminMemberSnapshot()).members[0];

it('resumes across sign-in, cancel and expiry, and stops on provider completion and real cancellation', async () => {
  store.clear();
  let cookie: PlatformSession = { ...actor, tier: 'free', subscriptionStatus: 'canceled' };
  jest.mocked(getPlatformSession).mockImplementation(async () => cookie);
  jest.mocked(setPlatformSession).mockImplementation(async value => { cookie = value; });
  (auth.listUsers as jest.Mock).mockResolvedValue({ users: [actor] });
  (auth.verifyIdToken as jest.Mock).mockResolvedValue(actor);
  (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_first' });
  (stripe.customers.retrieve as jest.Mock).mockResolvedValue({ id: 'cus_first', deleted: false });
  type Hosted = { id: string; status: string; expires_at: number; url: string };
  const hosted: Hosted[] = [];
  (stripe.checkout.sessions.list as jest.Mock).mockImplementation(async ({ status }) => ({
    data: hosted.filter(item => !status || item.status === status).toReversed(), has_more: false,
  }));
  (stripe.checkout.sessions.create as jest.Mock).mockImplementation(async params => {
    const id = 'cs_test_' + (hosted.length + 1);
    const item = { ...params, id, url: 'https://checkout.stripe.com/' + id,
      status: 'open', expires_at: Date.now() / 1000 + 3600 };
    hosted.push(item);
    return item;
  });
  const login = async (signup = false) => (await signIn(req('/api/auth/callback', {
    idToken: 'actor-token', trialSignup: signup, affiliateCode: 'lucas', affiliateCapturedAt: Date.now(),
  }))).json();
  await login(true);
  expect(await recover()).toMatchObject({ reason: 'trial' });
  expect((await login()).billingRecovery.required).toBe(true); // Left before choosing a plan.
  (stripe.checkout.sessions.create as jest.Mock).mockRejectedValueOnce(new Error('Stripe unavailable'));
  expect((await recovery(req('/api/billing/recovery', selection))).status).toBe(500);
  expect((await login()).billingRecovery).toMatchObject(selection);
  const first = await recover(selection);
  expect(first.checkoutUrl).toBe(hosted[0].url);
  expect(await recover()).toMatchObject({ reason: 'checkout_pending', ...selection });
  cookie = { ...actor, tier: 'free', subscriptionStatus: 'no_plan' };
  expect(await (await hydrate()).json()).toMatchObject({
    subscriptionStatus: 'checkout_pending', billingRecovery: { required: true, ...selection },
  });
  expect(cookie).toMatchObject({ tier: 'free', subscriptionStatus: 'checkout_pending' });
  expect(await admin()).toMatchObject({ membershipState: 'checkout_pending', tier: 'free', selectedTier: 'economy', referredBy: 'lucas' });
  const canceled = await cancelReturn(new NextRequest(origin + '/api/billing/cancelled'));
  expect(canceled.headers.get('location')).toBe(origin + '/start-trial');
  for (let i = 0; i < 4; i++) expect((await recover(selection)).checkoutUrl).toBe(first.checkoutUrl);
  hosted[0].status = 'expired';
  expect((await recover(selection)).checkoutUrl).toBe(hosted[1].url);
  expect(hosted).toHaveLength(2);
  expect(stripe.customers.create).toHaveBeenCalledTimes(1);
  expect(store.read(billingPath)).toMatchObject({ customerId: 'cus_first', checkoutAttempt: 2 });
  hosted[1].status = 'complete';
  expect(await recover()).toEqual({ pending: false, reason: 'processing' });
  expect(await recover(selection)).toEqual({ pending: false, reason: 'processing' });
  expect(hosted).toHaveLength(2);

  const deliver = async (type: string, status: string) => webhook(new NextRequest(origin + '/api/webhooks/stripe', {
    method: 'POST', headers: { 'stripe-signature': 'fixture' },
    body: JSON.stringify({ id: type, type, data: { object: {
      id: 'sub_first', customer: 'cus_first', status, metadata: { platformUserId: actor.uid },
      items: { data: [{ price: { id: 'price_economy_annual' } }] },
    } } }),
  }));
  expect((await deliver('customer.subscription.created', 'trialing')).status).toBe(200);
  expect(store.read(userPath)?.billingRecovery).toMatchObject({ required: false });
  expect(await recover()).toEqual({ pending: false });
  expect((await login()).user).toMatchObject({ tier: 'economy', subscriptionStatus: 'trialing' });
  expect((await deliver('customer.subscription.deleted', 'canceled')).status).toBe(200);
  expect((await login()).billingRecovery).toBeUndefined();
  expect(await admin()).toMatchObject({ membershipState: 'canceled', tier: 'free', referredBy: 'lucas' });
  expect(await recover(selection)).toEqual({ pending: false });
});
