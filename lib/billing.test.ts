/**
 * Regression tests for the Stripe Price -> platform tier translation.
 *
 * A Price that the translation does not know becomes the "free" tier, and the
 * webhook writes that tier over the stored one. When a Price is retired while
 * subscriptions still point at it, every one of those customers is downgraded
 * on its next renewal while still being charged. These tests pin both the
 * current prices and the retired ones.
 */
describe('mapStripePriceToTier', () => {
  let mapStripePriceToTier: (priceId?: string) => string;
  let warnSpy: jest.SpyInstance;

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
    process.env.STRIPE_ECONOMY_PRICE_ID = 'price_economy_monthly';
    process.env.STRIPE_ECONOMY_ANNUAL_PRICE_ID = 'price_economy_annual';
    process.env.STRIPE_BUSINESS_PRICE_ID = 'price_business_monthly';
    process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID = 'price_business_annual';

    mapStripePriceToTier = require('./billing').mapStripePriceToTier;
  });

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('maps the prices configured in the environment', () => {
    expect(mapStripePriceToTier('price_economy_monthly')).toBe('economy');
    expect(mapStripePriceToTier('price_economy_annual')).toBe('economy');
    expect(mapStripePriceToTier('price_business_monthly')).toBe('business');
    expect(mapStripePriceToTier('price_business_annual')).toBe('business');
  });

  it('keeps the tier of retired prices that still have subscriptions', () => {
    expect(mapStripePriceToTier('price_1TuCshEnOTJRuCTXl1SD2vMr')).toBe('economy');
    expect(mapStripePriceToTier('price_1TwOUREnOTJRuCTXdUqc9fyK')).toBe('economy');
    expect(mapStripePriceToTier('price_1TuCsvEnOTJRuCTXbaAzTSbO')).toBe('business');
    expect(mapStripePriceToTier('price_1TwO6vEnOTJRuCTXl4ilzwrn')).toBe('business');
  });

  it('falls back to free for a price nobody knows', () => {
    expect(mapStripePriceToTier('price_unknown_forever')).toBe('free');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unmapped Stripe Price ID'));
  });

  it('returns free when there is no price at all', () => {
    expect(mapStripePriceToTier(undefined)).toBe('free');
    expect(mapStripePriceToTier('')).toBe('free');
  });
});
