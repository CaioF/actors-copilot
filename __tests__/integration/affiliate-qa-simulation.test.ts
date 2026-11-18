import type { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/admin/affiliate-qa/route';
import { POST as exchange } from '@/app/api/auth/callback/route';
import { buildAffiliateReport } from '@/lib/admin-dashboard/affiliates';
import { auth, db } from '@/lib/firebase.admin';
import { getPlatformSession, setPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import type { fixtureStore } from '@/qa/affiliates/fixture-store';

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
  auth: { getUser: jest.fn(), getUsers: jest.fn(), verifyIdToken: jest.fn() },
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

it.each(['link', 'coupon'])(
  'preserves ordinary %s attribution and billing before, during and after the demo',
  async (source) => {
    const original = { ...process.env };
    Object.assign(process.env, {
      QA_SIMULATION_ENABLED: 'true',
      QA_SIMULATION_SECRET: key,
      QA_SIMULATION_ALLOWED_UIDS: 'qa',
      QA_SIMULATION_ALLOWED_EMAILS: email,
      QA_SIMULATION_ALLOWED_AFFILIATES: 'lucas',
    });
    const member = source === 'link' ? { email, affiliateCode: 'lucas' } : { email };
    const billing = { customerId: 'cus_demo', tier: 'free' };
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
    (auth.verifyIdToken as jest.Mock).mockResolvedValue(buyer);
    (getPlatformSession as jest.Mock).mockResolvedValue({
      ...buyer,
      tier: 'free',
      subscriptionStatus: 'canceled',
    });
    (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({
      id: checkoutSessionId,
      mode: 'subscription',
      status: 'open',
      client_reference_id: 'qa',
      customer: 'cus_demo',
      discounts: [{ promotion_code: 'promo_demo' }],
      success_url: 'https://app.example/api/billing/success',
      metadata: {
        platformUserId: 'qa',
        targetTier: 'economy',
        isTrial: 'true',
        billingCycle: 'monthly',
        ...(source === 'link' ? { affiliateCode: 'lucas' } : {}),
      },
    });
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
      expect(
        (await POST(request('POST', { runId, checkoutSessionId, affiliateCode: 'lucas' }))).status,
      ).toBe(200);
      expect((await reauthenticate()).status).toBe(200);
      expect(setPlatformSession).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tier: 'economy',
          subscriptionStatus: 'trialing',
          qaExpiresAt: expect.any(Number),
        }),
      );
      const [during] = await buildAffiliateReport();
      expect(during).toEqual({ ...before, qaReferredCount: 1 });
      expect((await DELETE(request('DELETE', { uid: 'qa', runId }))).status).toBe(200);
      expect(await buildAffiliateReport()).toEqual([before]);
      expect((await reauthenticate()).status).toBe(200);
      expect(setPlatformSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ tier: 'free', subscriptionStatus: 'canceled' }),
      );
      expect(store.read('users/qa')).toEqual(member);
      expect(store.read('users/qa/billing/current')).toEqual(billing);
    } finally {
      process.env = original;
    }
  },
);
