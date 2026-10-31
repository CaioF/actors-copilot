import { POST } from './route';
import { NextRequest } from 'next/server';
import { verifyStripeWebhookEvent } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { stripe } from '@/lib/stripe';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { logger } from '@/lib/logger';

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

jest.mock('@/lib/admin-dashboard/sync', () => ({
  syncAdminMember: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Stripe Webhook Route Handler', () => {
  const mockUid = 'user_trial_test_123';
  const mockCustomerId = 'cus_stripe_123';

  beforeEach(() => {
    jest.clearAllMocks();
    (syncAdminMember as jest.Mock).mockResolvedValue(undefined);
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
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(syncAdminMember).toHaveBeenCalledWith(mockUid);
    expect(mockSet.mock.invocationCallOrder[1]).toBeLessThan(
      (syncAdminMember as jest.Mock).mock.invocationCallOrder[0],
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
    expect(syncAdminMember).toHaveBeenCalledWith(mockUid);
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
    expect(syncAdminMember).toHaveBeenCalledWith(mockUid);
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
    expect(syncAdminMember).toHaveBeenCalledWith(mockUid);
  });

  it.each([
    ['invoice.payment_succeeded', 'active', true],
    ['invoice.payment_failed', 'past_due', false],
  ])('syncs projection for %s after both billing writes', async (type, status, hasAccess) => {
    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
      type,
      id: `evt_${type}`,
      data: {
        object: {
          customer: mockCustomerId,
          customer_email: 'billing@example.com',
        },
      },
    });
    const mockSet = jest.fn().mockResolvedValue(undefined);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });
    (db.collectionGroup as jest.Mock).mockReturnValue({
      where: () => ({
        limit: () => ({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ ref: { path: `users/${mockUid}/billing/current` } }],
          }),
        }),
      }),
    });

    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: '{}',
    }) as NextRequest);

    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status, hasAccess }),
      { merge: true },
    );
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(syncAdminMember).toHaveBeenCalledWith(mockUid);
  });

  it('does not wipe the stored tier when an invoice event carries no tier', async () => {
    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
      type: 'invoice.payment_succeeded',
      id: 'evt_invoice_without_tier',
      data: {
        object: {
          customer: mockCustomerId,
          customer_email: 'billing@example.com',
        },
      },
    });
    const mockSet = jest.fn().mockResolvedValue(undefined);
    (db.doc as jest.Mock).mockReturnValue({ set: mockSet });
    (db.collectionGroup as jest.Mock).mockReturnValue({
      where: () => ({
        limit: () => ({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [{ ref: { path: `users/${mockUid}/billing/current` } }],
          }),
        }),
      }),
    });

    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: '{}',
    }) as NextRequest);

    expect(res.status).toBe(200);

    // Both documents are merged, so a tier that the event does not carry has to
    // stay absent instead of being written as null: otherwise a payment would
    // erase the plan of the customer that made it.
    expect(mockSet).toHaveBeenCalledTimes(2);
    for (const call of mockSet.mock.calls) {
      expect(call[0]).not.toHaveProperty('tier');
    }
  });

  it('acknowledges the webhook and logs no PII when projection synchronization fails', async () => {
    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.created',
      id: 'evt_projection_failure',
      data: {
        object: {
          id: 'sub_private',
          customer: mockCustomerId,
          status: 'active',
          metadata: { platformUserId: mockUid },
          items: { data: [{ price: { id: 'price_economy' } }] },
        },
      },
    });
    (db.doc as jest.Mock).mockReturnValue({ set: jest.fn().mockResolvedValue(undefined) });
    (syncAdminMember as jest.Mock).mockRejectedValue(
      Object.assign(new Error('private projection failure'), { code: 'unavailable' }),
    );

    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: '{}',
    }) as NextRequest);

    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith({
      errorName: 'Error',
      errorCode: 'unavailable',
      msg: 'Admin member projection sync failed after billing persistence',
    });
    const logged = JSON.stringify((logger.error as jest.Mock).mock.calls);
    expect(logged).not.toContain(mockUid);
    expect(logged).not.toContain(mockCustomerId);
    expect(logged).not.toContain('private projection failure');
  });

  it('returns 500 and does not sync projection when a billing write fails', async () => {
    (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
      type: 'customer.subscription.created',
      id: 'evt_billing_failure',
      data: {
        object: {
          id: 'sub_123',
          customer: mockCustomerId,
          status: 'active',
          metadata: { platformUserId: mockUid },
          items: { data: [{ price: { id: 'price_economy' } }] },
        },
      },
    });
    (db.doc as jest.Mock).mockReturnValue({
      set: jest.fn().mockRejectedValue(new Error('billing write failed')),
    });

    const res = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_123' },
      body: '{}',
    }) as NextRequest);

    expect(res.status).toBe(500);
    expect(syncAdminMember).not.toHaveBeenCalled();
  });
});
