import type { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/admin/affiliate-qa/route';
import { POST as exchange } from '@/app/api/auth/callback/route';
import { GET as checkoutSuccess } from '@/app/api/billing/success/route';
import { buildAffiliateReport } from '@/lib/admin-dashboard/affiliates';
import { listAdminMemberSnapshot } from '@/lib/admin-dashboard/members';
import { auth, db } from '@/lib/firebase.admin';
import { getPlatformSession, setPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import type { fixtureStore } from '@/qa/affiliates/fixture-store';

jest.mock('@/lib/billing', () => ({
  getStripePriceIdForTier: (tier: string, cycle: string) => 'price_' + tier + '_' + cycle,
}));

jest.mock('@/lib/admin-dashboard/session', () => ({ getAdminSession: async () => ({ sub: 'admin' }) }));
jest.mock('@/lib/admin-dashboard/sync', () => ({ syncAdminMember: jest.fn() }));
jest.mock('@/lib/verified-trial-restart', () => ({ canRestartInvalidBillingTrial: async () => false }));
jest.mock('@/lib/session', () => ({
  setPlatformSession: jest.fn(),
  getPlatformSession: jest.fn(),
  deletePlatformSession: jest.fn(),
}));
jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { list: async () => ({ data: [], has_more: false }) },
    invoices: { list: async () => ({ data: [], has_more: false }) },
  },
}));
jest.mock('@/lib/firebase.admin', () => ({
  auth: { getUser: jest.fn(), getUsers: jest.fn(), listUsers: jest.fn(), verifyIdToken: jest.fn() },
  db: jest.requireActual('@/qa/affiliates/fixture-store').fixtureStore(),
}));

const store = db as unknown as ReturnType<typeof fixtureStore>;
const key = 'a'.repeat(64);
const runId = '550e8400-e29b-41d4-a716-446655440000';
const email = 'actor@example.test';
const buyer = { uid: 'qa', email };
const checkoutSessionId = 'cs_test_0123456789';
const request = (method: string, body: unknown) =>
  new Request('https://app.example/api/admin/affiliate-qa', {
    method,
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest;

it.each([
  ['link', 'economy'], ['link', 'business'], ['coupon', 'economy'], ['coupon', 'business'],
])(
  'keeps the %s referral and the selected %s tier consistent through the checkout return, refresh and cleanup',
  async (source, tier) => {
    jest.clearAllMocks();
    const original = { ...process.env };
    Object.assign(process.env, {
      QA_SIMULATION_ENABLED: 'true',
      QA_SIMULATION_SECRET: key,
      QA_SIMULATION_ALLOWED_UIDS: 'qa',
      QA_SIMULATION_ALLOWED_EMAILS: email,
      QA_SIMULATION_ALLOWED_AFFILIATES: 'lucas',
    });
    const member = source === 'link' ? { email, affiliateCode: 'lucas' } : { email };
    const billing = { customerId: 'cus_demo', tier: 'free', status: 'canceled', checkoutAttempt: 1 };
    store.clear();
    store.seed('users/qa', member);
    store.seed('users/qa/billing/current', billing);
    store.seed('affiliates/lucas', {
      name: 'Lucas',
      active: true,
      promotionCodeId: 'promo_demo',
      rate: 0.3,
    });
    (auth.getUser as jest.Mock).mockResolvedValue(buyer);
    (auth.getUsers as jest.Mock).mockResolvedValue({ users: [buyer] });
    (auth.listUsers as jest.Mock).mockResolvedValue({ users: [buyer] });
    (auth.verifyIdToken as jest.Mock).mockResolvedValue(buyer);
    (getPlatformSession as jest.Mock).mockResolvedValue({
      ...buyer,
      tier: 'free',
      subscriptionStatus: 'canceled',
    });
    const stripeCheckout = {
      id: checkoutSessionId,
      mode: 'subscription',
      status: 'open',
      client_reference_id: 'qa',
      customer: 'cus_demo',
      discounts: [{ promotion_code: 'promo_demo' }],
      success_url: 'https://app.example/api/billing/success?session_id={CHECKOUT_SESSION_ID}',
      line_items: { data: [{ price: { id: 'price_' + tier + '_monthly' } }], has_more: false },
      metadata: {
        platformUserId: 'qa',
        targetTier: tier,
        isTrial: 'true',
        billingCycle: 'monthly',
        ...(source === 'link' ? { affiliateCode: 'lucas' } : {}),
      },
    };
    (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue(stripeCheckout);
    const adminRow = async () => (await listAdminMemberSnapshot()).members[0];
    const baseline = { membershipState: 'checkout_pending', tier: 'free', referredBy: source === 'link' ? 'lucas' : null };
    const returnTo = (path: string) => checkoutSuccess(new Request(new URL(path, 'https://app.example')) as NextRequest);
    const reauthenticate = () =>
      exchange(
        new Request('https://app.example/api/auth/callback', {
          method: 'POST',
          body: JSON.stringify({ idToken: 'synthetic-token' }),
        }) as NextRequest,
      );
    try {
      const [before] = await buildAffiliateReport();
      expect(before.referredCount).toBe(source === 'link' ? 1 : 0);
      expect(await adminRow()).toMatchObject(baseline);
      const path = '/api/billing/success?session_id=' + checkoutSessionId;
      await returnTo(path);
      expect(setPlatformSession).not.toHaveBeenCalled();
      const form = new Request('https://app.example/api/admin/affiliate-qa', {
        method: 'POST', headers: { origin: 'https://app.example' },
        body: new URLSearchParams({ runId, checkoutSessionId, affiliateCode: 'lucas', key }),
      }) as NextRequest;
      const confirmation = await POST(form);
      expect(confirmation.status).toBe(303);
      expect(confirmation.headers.get('location')).toBe(path);
      expect(setPlatformSession).not.toHaveBeenCalled();

      (getPlatformSession as jest.Mock).mockResolvedValueOnce({ uid: 'other', email: 'other@example.test' });
      await returnTo(path);
      (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValueOnce({ ...stripeCheckout, id: 'cs_test_other' });
      await returnTo('/api/billing/success?session_id=cs_test_other');
      expect(setPlatformSession).not.toHaveBeenCalled();

      const returned = await returnTo(confirmation.headers.get('location')!);
      expect(returned.headers.get('location')).toBe('https://app.example/dashboard');
      const session = expect.objectContaining({
        uid: buyer.uid, email, tier,
        subscriptionStatus: 'trialing',
        qaExpiresAt: expect.any(Number),
      });
      expect(setPlatformSession).toHaveBeenCalledTimes(1);
      expect(setPlatformSession).toHaveBeenLastCalledWith(session);
      expect((await reauthenticate()).status).toBe(200);
      expect(setPlatformSession).toHaveBeenLastCalledWith(session);
      expect(await adminRow()).toMatchObject({ membershipState: 'trial', subscriptionStatus: 'trialing', tier, referredBy: 'lucas', qaSimulation: true });
      const [during] = await buildAffiliateReport();
      expect(during).toEqual({ ...before, qaReferredCount: 1 });
      expect((await DELETE(request('DELETE', { uid: 'qa', runId }))).status).toBe(200);
      expect(await buildAffiliateReport()).toEqual([before]);
      expect(await adminRow()).toMatchObject(baseline);
      (setPlatformSession as jest.Mock).mockClear();
      await returnTo(path);
      expect(setPlatformSession).not.toHaveBeenCalled();
      expect((await reauthenticate()).status).toBe(200);
      expect(setPlatformSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ tier: 'free', subscriptionStatus: 'checkout_pending' }),
      );
      expect(store.read('users/qa')).toEqual(member);
      expect(store.read('users/qa/billing/current')).toEqual(billing);
    } finally {
      process.env = original;
    }
  },
);
