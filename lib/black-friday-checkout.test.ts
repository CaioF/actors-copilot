import { resolveBlackFridayCoupon, validateBlackFridayCode } from './black-friday-checkout';
import { BLACK_FRIDAY_END, BLACK_FRIDAY_START } from './black-friday';
import { stripe } from './stripe';

jest.mock('./stripe', () => ({ stripe: { subscriptions: { list: jest.fn() } } }));

describe('BLACKFRIDAY checkout', () => {
  const subscriptions = jest.mocked(stripe.subscriptions.list);

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(BLACK_FRIDAY_START);
    subscriptions.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  it('opens at the first instant and closes at the deadline', () => {
    jest.spyOn(Date, 'now').mockReturnValue(BLACK_FRIDAY_START - 1);
    expect(() => validateBlackFridayCode('BLACKFRIDAY', 'annual', 'usd')).toThrow('redemption window');
    jest.spyOn(Date, 'now').mockReturnValue(BLACK_FRIDAY_START);
    expect(validateBlackFridayCode(' blackfriday ', 'annual', 'usd')).toBe(true);
    jest.spyOn(Date, 'now').mockReturnValue(BLACK_FRIDAY_END - 1);
    expect(validateBlackFridayCode('BLACKFRIDAY', 'annual', 'usd')).toBe(true);
    jest.spyOn(Date, 'now').mockReturnValue(BLACK_FRIDAY_END);
    expect(() => validateBlackFridayCode('BLACKFRIDAY', 'annual', 'usd')).toThrow('redemption window');
  });

  it('limits the code to annual USD and leaves ordinary checkout available', () => {
    expect(validateBlackFridayCode(undefined, 'monthly', 'usd')).toBe(false);
    expect(() => validateBlackFridayCode('BLACKFRIDAY', 'monthly', 'usd')).toThrow('annual');
    expect(() => validateBlackFridayCode('BLACKFRIDAY', 'annual', 'eur')).toThrow('USD');
  });

  it('selects the tier coupon for a customer with only monthly history', async () => {
    subscriptions.mockImplementation(async function* () {
      yield { items: { data: [{ price: { recurring: { interval: 'month' } } }] } };
    } as unknown as typeof stripe.subscriptions.list);
    await expect(resolveBlackFridayCoupon('cus_new', 'economy')).resolves.toBe('blackfriday-2026-economy-annual');
    await expect(resolveBlackFridayCoupon('cus_new', 'business')).resolves.toBe('blackfriday-2026-business-annual');
  });

  it('rejects a prior annual subscription, even if it was canceled', async () => {
    subscriptions.mockImplementation(async function* () {
      yield { status: 'canceled', items: { data: [{ price: { recurring: { interval: 'year' } } }] } };
    } as unknown as typeof stripe.subscriptions.list);
    await expect(resolveBlackFridayCoupon('cus_existing', 'business')).rejects.toThrow('first annual subscription');
  });
});
