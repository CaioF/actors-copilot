import type { NextRequest } from 'next/server';
import { GET } from './route';
import { db } from '@/lib/firebase.admin';
import { getPlatformSession, setPlatformSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';

jest.mock('@/lib/firebase.admin', () => ({ db: { doc: jest.fn() } }));
jest.mock('@/lib/session', () => ({ getPlatformSession: jest.fn(), setPlatformSession: jest.fn() }));
jest.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { retrieve: jest.fn() } } } }));

it('refreshes a completed Stripe checkout from the webhook billing record when it arrives after the redirect', async () => {
  const billing = { customerId: 'cus_member', subscriptionId: 'sub_trial', tier: 'business', status: 'trialing' };
  const get = jest.fn()
    .mockResolvedValueOnce({ exists: true, data: () => ({ customerId: 'cus_member' }) })
    .mockResolvedValue({ exists: true, data: () => billing });
  (db.doc as jest.Mock).mockReturnValue({ get });
  (stripe.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({
    id: 'cs_1', status: 'complete', mode: 'subscription', client_reference_id: 'actor', subscription: 'sub_trial',
    customer_details: { email: 'actor@example.test' },
  });
  const response = await GET(new Request('https://app.example/api/billing/success?session_id=cs_1') as NextRequest);
  expect(response.headers.get('location')).toBe('https://app.example/dashboard');
  expect(get).toHaveBeenCalledTimes(2);
  expect(getPlatformSession).not.toHaveBeenCalled();
  expect(setPlatformSession).toHaveBeenCalledWith(expect.objectContaining({
    uid: 'actor', email: 'actor@example.test', tier: 'business', subscriptionStatus: 'trialing',
    stripeCustomerId: 'cus_member', stripeSubscriptionId: 'sub_trial',
  }));
  expect((setPlatformSession as jest.Mock).mock.calls[0][0]).not.toHaveProperty('qaExpiresAt');
});
