import { POST } from './route';
import { NextRequest } from 'next/server';
import { verifyStripeWebhookEvent } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { stripe } from '@/lib/stripe';

jest.mock('@/lib/billing', () => ({
  verifyStripeWebhookEvent: jest.fn(),
  mapStripePriceToTier: jest.fn((priceId) => (priceId === 'price_economy' ? 'economy' : 'free')),
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { retrieve: jest.fn() },
    checkout: { sessions: { listLineItems: jest.fn() } },
    customers: { retrieve: jest.fn() },
  },
}));

jest.mock('@/lib/firebase.admin', () => ({
  db: {
    doc: jest.fn(),
    collectionGroup: jest.fn(),
    collection: jest.fn(),
  },
}));

describe('Stripe Webhook Route Handler', () => {
  const mockUid = 'user_trial_test_123';
  const mockCustomerId = 'cus_stripe_123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 Bad Request if stripe-signature header is missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({}),
    }) as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('processes checkout.session.completed for a trial session and sets status=trialing & hasAccess=true', async () => {
    const eventPayload = {
      type: 'checkout.session.completed',
      id: 'evt_123',
      data: {
        object: {
          id: 'cs_test_123',
          customer: mockCustomerId,
          client_reference_id: mockUid,
          subscription: 'sub_123',
          metadata: { isTrial: 'true', targetTier: 'economy' },
        },
      },
    };

    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue(eventPayload);
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
      id: 'sub_123',
      status: 'trialing',
      trial_start: 1700000000,
      trial_end: 1701209600,
      items: { data: [{ price: { id: 'price_economy' } }] },
    });

    const mockSet = jest.fn().mockResolvedValue(true);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });

    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: JSON.stringify(eventPayload),
    }) as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: mockCustomerId,
        subscriptionId: 'sub_123',
        status: 'trialing',
        hasAccess: true,
        hasUsedTrial: true,
        trialStart: 1700000000,
        trialEnd: 1701209600,
      }),
      { merge: true }
    );
  });

  it('processes customer.subscription.updated transition from trialing to active on Day 15 seamlessly', async () => {
    const eventPayload = {
      type: 'customer.subscription.updated',
      id: 'evt_sub_upd',
      data: {
        object: {
          id: 'sub_123',
          customer: mockCustomerId,
          status: 'active',
          metadata: { platformUserId: mockUid },
          items: { data: [{ price: { id: 'price_economy' } }] },
          current_period_end: 1702500000,
          cancel_at_period_end: false,
        },
      },
    };

    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue(eventPayload);

    const mockSet = jest.fn().mockResolvedValue(true);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });

    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: JSON.stringify(eventPayload),
    }) as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: mockCustomerId,
        subscriptionId: 'sub_123',
        status: 'active',
        hasAccess: true,
      }),
      { merge: true }
    );
  });

  it('processes customer.subscription.updated when canceled at period end while keeping hasAccess=true', async () => {
    const eventPayload = {
      type: 'customer.subscription.updated',
      id: 'evt_sub_cancel_pending',
      data: {
        object: {
          id: 'sub_123',
          customer: mockCustomerId,
          status: 'trialing',
          metadata: { platformUserId: mockUid },
          items: { data: [{ price: { id: 'price_economy' } }] },
          current_period_end: 1702500000,
          cancel_at_period_end: true,
          cancel_at: 1702500000,
        },
      },
    };

    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue(eventPayload);

    const mockSet = jest.fn().mockResolvedValue(true);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });

    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: JSON.stringify(eventPayload),
    }) as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: mockCustomerId,
        subscriptionId: 'sub_123',
        status: 'trialing',
        hasAccess: true,
        cancelAtPeriodEnd: true,
        cancelAt: 1702500000,
      }),
      { merge: true }
    );
  });

  it('processes customer.subscription.deleted when period ends setting status=canceled & hasAccess=false', async () => {
    const eventPayload = {
      type: 'customer.subscription.deleted',
      id: 'evt_sub_deleted',
      data: {
        object: {
          id: 'sub_123',
          customer: mockCustomerId,
          status: 'canceled',
          metadata: { platformUserId: mockUid },
          items: { data: [{ price: { id: 'price_economy' } }] },
          current_period_end: 1702500000,
          cancel_at_period_end: false,
        },
      },
    };

    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue(eventPayload);

    const mockSet = jest.fn().mockResolvedValue(true);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });

    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: JSON.stringify(eventPayload),
    }) as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: mockCustomerId,
        subscriptionId: 'sub_123',
        status: 'canceled',
        subscriptionStatus: 'canceled',
        hasAccess: false,
        tier: 'free',
        cancelAtPeriodEnd: false,
      }),
      { merge: true }
    );
  });
});
