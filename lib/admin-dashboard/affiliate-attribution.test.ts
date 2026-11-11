/**
 * Tests for the coupon code attribution.
 *
 * The rules that matter: a code that is not one of ours is never stored on a
 * member, the first touch wins, and the clock starts when the code was
 * applied so the payment that carries the discount still counts towards the
 * commission.
 */

jest.mock('@/lib/firebase.admin', () => {
  const store = new Map<string, Record<string, unknown>>();

  const readRef = (path: string) => ({
    exists: store.has(path),
    data: () => store.get(path),
  });

  const writeRef = (path: string, data: Record<string, unknown>) => {
    store.set(path, { ...(store.get(path) ?? {}), ...data });
  };

  return {
    db: {
      __seed: (path: string, data: Record<string, unknown>) => {
        store.set(path, { ...data });
      },
      __read: (path: string) => store.get(path),
      __clear: () => store.clear(),
      doc: (path: string) => ({
        path,
        get: async () => readRef(path),
        set: async (data: Record<string, unknown>) => writeRef(path, data),
      }),
      runTransaction: async (fn: (transaction: unknown) => Promise<boolean>) =>
        fn({
          get: async (ref: { path: string }) => readRef(ref.path),
          set: (ref: { path: string }, data: Record<string, unknown>) => writeRef(ref.path, data),
        }),
    },
  };
});

jest.mock('@/lib/stripe', () => ({ stripe: {} }));

jest.mock('@/lib/affiliate-promotion-codes', () => ({
  ensureAffiliatePromotionCode: jest.fn(),
  readPromotionCodeAffiliateCode: jest.fn(async (id: string) =>
    id === 'promo_lucas' ? 'lucas' : null,
  ),
}));

import type Stripe from 'stripe';
import { db } from '@/lib/firebase.admin';
import { attributeAffiliateFromSession, extractSessionAffiliateCandidates } from './affiliates';

const mockDb = db as unknown as {
  __seed: (path: string, data: Record<string, unknown>) => void;
  __read: (path: string) => Record<string, unknown> | undefined;
  __clear: () => void;
};

const LUCAS = {
  code: 'lucas',
  name: 'Lucas Amorim',
  email: 'lucas@example.com',
  rate: 0.3,
  active: true,
  notes: '',
  promotionCode: 'LUCAS',
  promotionCodeId: 'promo_lucas',
  couponId: 'affiliate_default',
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
};

describe('extractSessionAffiliateCandidates', () => {
  it('reads the code from the session metadata and the promotion code from the discount', () => {
    const candidates = extractSessionAffiliateCandidates({
      metadata: { affiliateCode: 'lucas' },
      discounts: [{ promotion_code: 'promo_lucas' }],
    });

    expect(candidates.codes).toEqual(['lucas']);
    expect(candidates.promotionCodeIds).toEqual(['promo_lucas']);
  });

  it('survives a session with neither', () => {
    const candidates = extractSessionAffiliateCandidates({ metadata: {}, discounts: [] });

    expect(candidates.codes).toEqual([]);
    expect(candidates.promotionCodeIds).toEqual([]);
  });

  it('reads the affiliate from an expanded promotion code', () => {
    const candidates = extractSessionAffiliateCandidates({
      metadata: {},
      discounts: [
        {
          promotion_code: {
            id: 'promo_lucas',
            code: 'LUCAS',
            metadata: { affiliateCode: 'lucas' },
          } as unknown as Stripe.PromotionCode,
        },
      ],
    });

    expect(candidates.codes).toEqual(['lucas']);
    expect(candidates.promotionCodeIds).toEqual([]);
  });
});

describe('attributeAffiliateFromSession', () => {
  beforeEach(() => {
    mockDb.__clear();
    mockDb.__seed('affiliates/lucas', LUCAS);
  });

  it('credits the affiliate whose promotion code was used', async () => {
    mockDb.__seed('users/member-1', { email: 'member@example.com' });

    const affiliate = await attributeAffiliateFromSession('member-1', {
      created: 1_700_000_000,
      metadata: {},
      discounts: [{ promotion_code: 'promo_lucas' }],
    });

    expect(affiliate?.code).toBe('lucas');
    expect(mockDb.__read('users/member-1')).toMatchObject({
      affiliateCode: 'lucas',
      affiliateCapturedAt: 1_700_000_000 * 1000,
    });
  });

  it('never stores a code that is not one of ours', async () => {
    mockDb.__seed('users/member-2', { email: 'member@example.com' });

    const affiliate = await attributeAffiliateFromSession('member-2', {
      created: 1_700_000_000,
      metadata: { affiliateCode: 'someone-elses-code' },
      discounts: [],
    });

    expect(affiliate).toBeNull();
    expect(mockDb.__read('users/member-2')?.affiliateCode).toBeUndefined();
  });

  it('credits the affiliate from an expanded promotion code', async () => {
    mockDb.__seed('users/member-4', { email: 'member@example.com' });

    const affiliate = await attributeAffiliateFromSession('member-4', {
      created: 1_700_000_000,
      metadata: {},
      discounts: [
        {
          promotion_code: {
            id: 'promo_lucas',
            code: 'LUCAS',
            metadata: { affiliateCode: 'lucas' },
          } as unknown as Stripe.PromotionCode,
        },
      ],
    });

    expect(affiliate?.code).toBe('lucas');
    expect(mockDb.__read('users/member-4')?.affiliateCode).toBe('lucas');
  });

  it('keeps the first attribution when a second code arrives later', async () => {
    mockDb.__seed('users/member-3', {
      email: 'member@example.com',
      affiliateCode: 'lucas',
      affiliateCapturedAt: 1_600_000_000_000,
    });

    const affiliate = await attributeAffiliateFromSession('member-3', {
      created: 1_700_000_000,
      metadata: { affiliateCode: 'someone-elses-code' },
      discounts: [],
    });

    expect(affiliate).toBeNull();
    expect(mockDb.__read('users/member-3')?.affiliateCode).toBe('lucas');
    expect(mockDb.__read('users/member-3')?.affiliateCapturedAt).toBe(1_600_000_000_000);
  });
});
