import { POST } from './route';
import { canRestartInvalidBillingTrial } from '@/lib/verified-trial-restart';
jest.mock('@/lib/verified-trial-restart', () => ({ canRestartInvalidBillingTrial: jest.fn() }));
import { NextRequest } from 'next/server';
import { getPlatformSession } from '@/lib/session';
import { db } from '@/lib/firebase.admin';
import { getStripePriceIdForTier } from '@/lib/billing';
import { getPriceCurrencies } from '@/lib/billing-currency';
import { createOrReuseCheckoutSession } from '@/lib/billing-checkout';
import { resolveAppUrl } from '@/lib/app-origin';

jest.mock('@/lib/session', () => ({
    getPlatformSession: jest.fn(),
}));

jest.mock('@/lib/firebase.admin', () => ({
    db: { doc: jest.fn() },
}));

jest.mock('@/lib/billing', () => ({
    getStripePriceIdForTier: jest.fn(),
}));

jest.mock('@/lib/billing-currency', () => ({
    getPriceCurrencies: jest.fn(),
}));

jest.mock('@/lib/billing-checkout', () => ({
    createOrReuseCheckoutSession: jest.fn(),
}));

jest.mock('@/lib/app-origin', () => ({
    resolveAppUrl: jest.fn(),
}));

describe('POST /api/billing/recovery', () => {
    const mockUid = 'actor_recovery_test_1';
    const mockEmail = 'actor_recovery@example.com';

    let mockUserGet: jest.Mock;
    let mockBillingGet: jest.Mock;
    let mockUpdate: jest.Mock;

    const buildRequest = (body?: Record<string, unknown>) =>
        new Request('http://localhost/api/billing/recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}),
        }) as NextRequest;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(canRestartInvalidBillingTrial).mockResolvedValue(false);

        mockUserGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
                email: mockEmail,
                billingRecovery: {
                    required: true,
                    tier: 'business',
                    currency: 'usd',
                    attempt: 0,
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                },
            }),
        });
        mockBillingGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', tier: 'free', status: 'canceled' }),
        });
        mockUpdate = jest.fn().mockResolvedValue(undefined);

        (db.doc as jest.Mock).mockImplementation((path: string) => ({
            get: path.includes('/billing/current') ? mockBillingGet : mockUserGet,
            update: mockUpdate,
        }));

        (getPlatformSession as jest.Mock).mockResolvedValue({ uid: mockUid, email: mockEmail });
        (getStripePriceIdForTier as jest.Mock).mockReturnValue('price_business_monthly');
        (getPriceCurrencies as jest.Mock).mockResolvedValue(['usd', 'eur', 'gbp']);
        (createOrReuseCheckoutSession as jest.Mock).mockResolvedValue({
            url: 'https://checkout.stripe.com/pay/cs_test_recovery',
        });
        (resolveAppUrl as jest.Mock).mockReturnValue('https://app.theactorscopilot.com');
    });

    it('returns 401 Unauthorized when there is no platform session', async () => {
        (getPlatformSession as jest.Mock).mockResolvedValue(null);

        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
    });

    it('reports pending:true for an account that still owes its trial, without a recovery flag', async () => {
        mockUserGet.mockResolvedValue({ exists: true, data: () => ({ email: mockEmail }) });

        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(true);
        // No interruption happened: the member simply has not picked a plan.
        expect(data.reason).toBe('trial');
        expect(createOrReuseCheckoutSession).not.toHaveBeenCalled();
    });

    it('does not write a recovery flag on an account that simply has not picked a plan', async () => {
        mockUserGet.mockResolvedValue({ exists: true, data: () => ({ email: mockEmail }) });

        await POST(buildRequest({ tier: 'economy', billingCycle: 'monthly', currency: 'usd' }));

        // The attempt counter belongs to the recovery flow. Writing it here
        // would leave a half flag on an account that never had one.
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('reports the recovery reason when the first checkout was interrupted', async () => {
        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(true);
        expect(data.reason).toBe('recovery');
    });

    it('reports pending:false when the account already redeemed the trial', async () => {
        mockBillingGet.mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', hasUsedTrial: true }),
        });

        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(false);
        expect(createOrReuseCheckoutSession).not.toHaveBeenCalled();
    });

    it('reports pending:false when the account already has a subscription', async () => {
        mockBillingGet.mockResolvedValue({
            exists: true,
            data: () => ({ customerId: 'cus_historical_888', subscriptionId: 'sub_existing' }),
        });

        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(false);
    });

    it('offers a real trial for a verified legacy test-mode binding without changing entitlements', async () => {
        jest.mocked(canRestartInvalidBillingTrial).mockResolvedValue(true);
        mockBillingGet.mockResolvedValue({ exists: true, data: () => ({
            tier: 'business', status: 'active', customerId: 'cus_testmode', subscriptionId: 'sub_testmode', hasUsedTrial: true,
        }) });
        const res = await POST(buildRequest({ tier: 'business', currency: 'usd' }));
        expect(res.status).toBe(200);
        expect((await res.json()).checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_recovery');
        expect(createOrReuseCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({isTrial:true}));
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({'billingRecovery.attempt':1}));
    });

    it('reports the pending state without opening a session when no selection is sent', async () => {
        const res = await POST(buildRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(true);
        expect(data.tier).toBe('business');
        expect(data.currency).toBe('usd');
        expect(data.checkoutUrl).toBeUndefined();
        expect(createOrReuseCheckoutSession).not.toHaveBeenCalled();
    });

    it('opens the checkout for the selected plan, cycle and currency', async () => {
        const res = await POST(buildRequest({ tier: 'economy', billingCycle: 'annual', currency: 'eur' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pending).toBe(true);
        expect(data.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_recovery');

        expect(createOrReuseCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                uid: mockUid,
                email: mockEmail,
                tier: 'economy',
                billingCycle: 'annual',
                currency: 'eur',
                isTrial: true,
            }),
        );
    });

    it('counts the attempt so the recovery flow cannot loop forever', async () => {
        await POST(buildRequest({ tier: 'business', billingCycle: 'monthly', currency: 'usd' }));

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                'billingRecovery.attempt': 1,
            }),
        );
    });

    it('sends the member back to the origin of the request, not to a fixed host', async () => {
        (resolveAppUrl as jest.Mock).mockReturnValue('https://app.theactorscopilot.com');

        await POST(buildRequest({ tier: 'business', billingCycle: 'monthly', currency: 'usd' }));

        // The Stripe success URL is built from this origin: a different host
        // would hold neither the platform cookie nor the Firebase session and
        // the member would land on the login screen instead of the dashboard.
        expect(resolveAppUrl).toHaveBeenCalledTimes(1);
        expect(createOrReuseCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ appUrl: 'https://app.theactorscopilot.com' }),
        );
    });

    it('rejects a currency the price does not support', async () => {
        (getPriceCurrencies as jest.Mock).mockResolvedValue(['usd']);

        const res = await POST(buildRequest({ tier: 'business', billingCycle: 'monthly', currency: 'gbp' }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.code).toBe('currency_unavailable');
        expect(createOrReuseCheckoutSession).not.toHaveBeenCalled();
    });
});
