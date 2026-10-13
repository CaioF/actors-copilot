/**
 * Unit tests for the billing entitlement mapping.
 *
 * Business rule under test: The Actors Copilot Green Room is a SINGLE Skool
 * membership. It is included with Economy and Business Class at no extra cost,
 * and it is also sold on its own as a community-only plan that must never grant
 * an app tier.
 */

jest.mock('@/lib/stripe', () => ({ stripe: {} }));

describe('lib/billing entitlement mapping', () => {
  const ORIGINAL_ENV = process.env;
  let billing: typeof import('./billing');

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
      STRIPE_ECONOMY_PRICE_ID: 'price_economy_monthly',
      STRIPE_ECONOMY_ANNUAL_PRICE_ID: 'price_economy_annual',
      STRIPE_BUSINESS_PRICE_ID: 'price_business_monthly',
      STRIPE_BUSINESS_ANNUAL_PRICE_ID: 'price_business_annual',
      STRIPE_GREEN_ROOM_PRICE_ID: 'price_green_room_monthly',
    };

    jest.resetModules();
    billing = require('./billing');
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('mapStripePriceToTier (app access)', () => {
    it('maps the community-only Green Room price to "free"', () => {
      expect(billing.mapStripePriceToTier('price_green_room_monthly')).toBe('free');
    });

    it('maps Economy monthly and annual prices to "economy"', () => {
      expect(billing.mapStripePriceToTier('price_economy_monthly')).toBe('economy');
      expect(billing.mapStripePriceToTier('price_economy_annual')).toBe('economy');
    });

    it('maps Business monthly and annual prices to "business"', () => {
      expect(billing.mapStripePriceToTier('price_business_monthly')).toBe('business');
      expect(billing.mapStripePriceToTier('price_business_annual')).toBe('business');
    });

    it('degrades unknown and missing prices to "free"', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(billing.mapStripePriceToTier('price_unknown')).toBe('free');
      expect(billing.mapStripePriceToTier(undefined)).toBe('free');
      warn.mockRestore();
    });
  });

  describe('mapStripePriceToCommunity (Skool Green Room)', () => {
    it('grants the Green Room for the community-only price', () => {
      expect(billing.mapStripePriceToCommunity('price_green_room_monthly')).toBe('green_room');
    });

    it('includes the Green Room with Economy at no extra cost', () => {
      expect(billing.mapStripePriceToCommunity('price_economy_monthly')).toBe('green_room');
      expect(billing.mapStripePriceToCommunity('price_economy_annual')).toBe('green_room');
    });

    it('includes the Green Room with Business at no extra cost', () => {
      expect(billing.mapStripePriceToCommunity('price_business_monthly')).toBe('green_room');
      expect(billing.mapStripePriceToCommunity('price_business_annual')).toBe('green_room');
    });

    it('returns "none" for unknown or missing prices', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(billing.mapStripePriceToCommunity('price_unknown')).toBe('none');
      expect(billing.mapStripePriceToCommunity(undefined)).toBe('none');
      warn.mockRestore();
    });
  });

  describe('resolveEntitlementsFromPrice', () => {
    it('returns no app tier for a community-only purchase', () => {
      expect(billing.resolveEntitlementsFromPrice('price_green_room_monthly')).toEqual({
        appTier: 'free',
        community: 'green_room',
      });
    });

    it('returns app tier plus community for Economy', () => {
      expect(billing.resolveEntitlementsFromPrice('price_economy_monthly')).toEqual({
        appTier: 'economy',
        community: 'green_room',
      });
    });

    it('returns app tier plus community for Business', () => {
      expect(billing.resolveEntitlementsFromPrice('price_business_annual')).toEqual({
        appTier: 'business',
        community: 'green_room',
      });
    });

    it('returns nothing for an unmapped price', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(billing.resolveEntitlementsFromPrice('price_unknown')).toEqual({
        appTier: 'free',
        community: 'none',
      });
      warn.mockRestore();
    });
  });

  describe('getStripeGreenRoomPriceId', () => {
    it('returns the configured Green Room price id', () => {
      expect(billing.getStripeGreenRoomPriceId()).toBe('price_green_room_monthly');
    });
  });
});
