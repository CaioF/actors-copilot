/**
 * Tests for the commission math.
 *
 * The money is what makes an affiliate program expensive to get wrong: a
 * refunded invoice must stop counting, a trial must be worth nothing, and the
 * pending amount must be the commission that was earned minus the transfers
 * that were already made.
 */

jest.mock('@/lib/firebase.admin', () => ({ db: { doc: jest.fn() } }));
jest.mock('@/lib/stripe', () => ({ stripe: {} }));

jest.mock('@/lib/affiliate-promotion-codes', () => ({ ensureAffiliatePromotionCode: jest.fn() }));

import { computeCommission, netCollectedFromInvoices, upsertAffiliate } from './affiliates';
import { ensureAffiliatePromotionCode } from '@/lib/affiliate-promotion-codes';
import { db } from '@/lib/firebase.admin';

describe('upsertAffiliate', () => {
  it('keeps the stored Stripe promotion when editing an existing referral profile', async () => {
    let record = {
      code: 'lucas',
      name: 'Lucas',
      promotionCode: 'LucasAmorim',
      promotionCodeId: 'promo_rotated',
      couponId: 'affiliate_default',
    };
    const set = jest.fn(async (update) => { record = { ...record, ...update }; });
    const get = jest.fn(async () => ({ data: () => record }));
    jest.mocked(db.doc).mockReturnValue({ get, set } as unknown as ReturnType<typeof db.doc>);

    const saved = await upsertAffiliate({ code: 'lucas', name: 'Lucas Amorim', rate: 0.3 });

    expect(ensureAffiliatePromotionCode).not.toHaveBeenCalled();
    expect(set.mock.calls[0][0]).not.toHaveProperty('promotionCode');
    expect(saved).toMatchObject({
      code: 'lucas',
      name: 'Lucas Amorim',
      promotionCode: 'LucasAmorim',
      promotionCodeId: 'promo_rotated',
    });
  });
});

describe('netCollectedFromInvoices', () => {
  it('sums the paid invoices per currency', () => {
    const totals = netCollectedFromInvoices([
      { currency: 'usd', amount_paid: 2900 },
      { currency: 'usd', amount_paid: 2900 },
      { currency: 'eur', amount_paid: 2600 },
    ]);

    expect(totals.get('usd')).toBe(5800);
    expect(totals.get('eur')).toBe(2600);
  });

  it('ignores an invoice that was never paid', () => {
    const totals = netCollectedFromInvoices([
      { currency: 'usd', amount_paid: 0 },
      { currency: 'usd', amount_paid: null },
      { currency: 'usd' },
    ]);

    expect(totals.size).toBe(0);
  });

  it('subtracts the amount credited back after the payment', () => {
    const totals = netCollectedFromInvoices([
      { currency: 'usd', amount_paid: 2900, post_payment_credit_notes_amount: 2900 },
    ]);

    expect(totals.size).toBe(0);
  });

  it('keeps the part of the payment that was not refunded', () => {
    const totals = netCollectedFromInvoices([
      { currency: 'usd', amount_paid: 2900, post_payment_credit_notes_amount: 1000 },
    ]);

    expect(totals.get('usd')).toBe(1900);
  });

  it('never reports a negative amount', () => {
    const totals = netCollectedFromInvoices([
      { currency: 'usd', amount_paid: 1000, post_payment_credit_notes_amount: 5000 },
    ]);

    expect(totals.size).toBe(0);
  });
});

describe('computeCommission', () => {
  it('applies the rate to the collected amount', () => {
    expect(computeCommission(10000, 0.3)).toBe(3000);
    expect(computeCommission(2900, 0.3)).toBe(870);
  });

  it('rounds to the nearest minor unit', () => {
    expect(computeCommission(999, 0.3)).toBe(300);
    expect(computeCommission(1, 0.3)).toBe(0);
  });

  it('earns nothing when nothing was collected', () => {
    expect(computeCommission(0, 0.3)).toBe(0);
    expect(computeCommission(-100, 0.3)).toBe(0);
  });
});
