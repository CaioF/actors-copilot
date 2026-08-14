import { POST } from './route';
import { NextRequest } from 'next/server';
import { verifyStripeWebhookEvent, mapStripePriceToTier } from '@/lib/billing';
import { db } from '@/lib/firebase.admin';
import { stripe } from '@/lib/stripe';

// LAYER MOCKS 
jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
    },
    checkout: {
      sessions: {
        listLineItems: jest.fn(),
      },
    },
    customers: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/billing', () => ({
    verifyStripeWebhookEvent: jest.fn(),
    mapStripePriceToTier: jest.fn(),
}));

jest.mock('@/lib/firebase.admin', () => ({
    db: {
        doc: jest.fn(),
        collectionGroup: jest.fn(),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('Stripe Inbound Webhook Gateway Route Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
            items: { data: [{ price: { id: 'price_premium_id' } }] },
        });
        (stripe.checkout.sessions.listLineItems as jest.Mock).mockResolvedValue({
            data: [{ price: { id: 'price_premium_id' } }],
        });
        (stripe.customers.retrieve as jest.Mock).mockResolvedValue({
            deleted: false,
            metadata: { platformUserId: 'actor_uid_777' },
            email: 'actor@example.com',
        });
    });

    /**
     * Test suite enforcing signature check constraints at the outer boundary.
     */
    it('returns 400 Bad Request if the required stripe-signature header is missing', async () => {
        const req = new Request('http://localhost/api/webhooks/stripe', {
            method: 'POST',
            body: 'raw_payload_body',
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Missing Required Stripe Signature Header');
    });

    /**
     * Test suite enforcing cryptographic bounds if verification utilities throw internal exceptions.
     */
    it('returns 400 Bad Request if the webhook signature verification protocol fails', async () => {
        (verifyStripeWebhookEvent as jest.Mock).mockImplementation(() => {
            throw new Error('Invalid signature matching constraint');
        });

        const req = new Request('http://localhost/api/webhooks/stripe', {
            method: 'POST',
            body: 'raw_payload_body',
            headers: { 'stripe-signature': 'invalid_sig' },
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Invalid Webhook Cryptographic Signature');
    });

    /**
     * Test suite verifying complete data flow orchestration on checkout completion event triggers.
     */
    it('handles checkout.session.completed event and persists explicit client configurations safely', async () => {
        const mockSessionObj = {
            id: 'cs_test_999',
            customer: 'cus_actor_checkout_123',
            subscription: 'sub_active_unverified_456',
            metadata: { platformUserId: 'actor_uid_777' },
            line_items: { data: [{ price: { id: 'price_premium_id' } }] },
        };

        (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
            id: 'evt_123',
            type: 'checkout.session.completed',
            data: { object: mockSessionObj },
        });
        (mapStripePriceToTier as jest.Mock).mockReturnValue('business');

        const mockSet = jest.fn().mockResolvedValue(true);
        (db.doc as jest.Mock).mockReturnValue({ set: mockSet });

        const req = new Request('http://localhost/api/webhooks/stripe', {
            method: 'POST',
            body: 'raw_payload_body',
            headers: { 'stripe-signature': 'valid_sig_header' },
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.received).toBe(true);

        expect(db.doc).toHaveBeenCalledWith('users/actor_uid_777/billing/current');
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cus_actor_checkout_123',
                subscriptionId: 'sub_active_unverified_456',
                tier: 'business',
                status: 'active',
            }),
            { merge: true }
        );
    });

    /**
     * Test suite verifying multi-product alignment schemas during subscription updates.
     */
    it('handles customer.subscription.updated and performs downstream state synchronization', async () => {
        const mockSubscriptionObj = {
            id: 'sub_active_unverified_456',
            customer: 'cus_actor_checkout_123',
            status: 'active',
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_premium_id' }, current_period_end: 1900000000 }] },
        };

        (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
            id: 'evt_456',
            type: 'customer.subscription.updated',
            data: { object: mockSubscriptionObj },
        });
        (mapStripePriceToTier as jest.Mock).mockReturnValue('business');

        const mockSet = jest.fn().mockResolvedValue(true);
        const mockBillingQueryDocs = [{ ref: { set: mockSet } }];
        const mockGet = jest.fn().mockResolvedValue({
            empty: false,
            docs: mockBillingQueryDocs,
        });

        const mockWhere = jest.fn().mockReturnThis();
        const mockLimit = jest.fn().mockReturnThis();
        (db.collectionGroup as jest.Mock).mockReturnValue({
            where: mockWhere,
            limit: mockLimit,
            get: mockGet,
        });

        const req = new Request('http://localhost/api/webhooks/stripe', {
            method: 'POST',
            body: 'raw_payload_body',
            headers: { 'stripe-signature': 'valid_sig_header' },
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.received).toBe(true);

        expect(db.collectionGroup).toHaveBeenCalledWith('billing');
        expect(mockWhere).toHaveBeenCalledWith('customerId', '==', 'cus_actor_checkout_123');
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: 'sub_active_unverified_456',
                status: 'active',
                tier: 'business',
                cancelAtPeriodEnd: false,
            }),
            { merge: true }
        );
    });

    /**
     * Test suite validating invoice reconciliation workflows on success confirmations.
     */
    it('handles invoice.payment_succeeded and shifts the local profile status state to active', async () => {
        const mockInvoiceObj = {
            id: 'in_mock_invoice_000',
            customer: 'cus_actor_checkout_123',
            subscription: 'sub_active_unverified_456',
        };

        (verifyStripeWebhookEvent as jest.Mock).mockReturnValue({
            id: 'evt_789',
            type: 'invoice.payment_succeeded',
            data: { object: mockInvoiceObj },
        });

        const mockSet = jest.fn().mockResolvedValue(true);
        const mockBillingQueryDocs = [{ ref: { set: mockSet } }];
        const mockGet = jest.fn().mockResolvedValue({
            empty: false,
            docs: mockBillingQueryDocs,
        });

        const mockWhere = jest.fn().mockReturnThis();
        const mockLimit = jest.fn().mockReturnThis();
        (db.collectionGroup as jest.Mock).mockReturnValue({
            where: mockWhere,
            limit: mockLimit,
            get: mockGet,
        });

        const req = new Request('http://localhost/api/webhooks/stripe', {
            method: 'POST',
            body: 'raw_payload_body',
            headers: { 'stripe-signature': 'valid_sig_header' },
        }) as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.received).toBe(true);

        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'active',
            }),
            { merge: true }
        );
    });
});