import { unfinishedCheckout } from './first-checkout';

const seed = { customerId: 'cus_first', checkoutAttempt: 1, status: 'canceled', tier: 'free' };
const choice = { tier: 'economy', billingCycle: 'annual', currency: 'eur' };
const flag = { required: true, reason: 'checkout_pending', attempt: 10, ...choice };

describe('unfinished first checkout', () => {
  it('distinguishes signup, a historical attempt without selection, and a saved choice', () => {
    expect(unfinishedCheckout({}, {})).toBeNull();
    expect(unfinishedCheckout({}, { customerId: 'cus_first' })).toBeNull();
    expect(unfinishedCheckout({ billingRecovery: { reason: 'trial_selection', required: true } }, {}))
      .toEqual({ awaitingSelection: true, choice: null });
    expect(unfinishedCheckout({}, seed)).toEqual({ choice: null });
    expect(unfinishedCheckout({ billingRecovery: flag }, seed)).toEqual({ choice });
  });

  it.each([
    [{}, { ...seed, subscriptionId: 'sub_canceled' }],
    [{}, { ...seed, subscriptionStatus: 'canceled' }],
    [{}, { ...seed, status: 'incomplete_expired' }],
    [{ hasUsedTrial: true }, seed],
    [{ subscriptionStatus: 'canceled' }, seed],
    [{}, { hasAccess: true, tier: 'business', status: 'trialing' }],
  ])('a stale flag cannot reopen a real subscription or used trial', (member, billing) => {
    expect(unfinishedCheckout({ ...member, billingRecovery: flag }, billing)).toBeNull();
  });

  it('does not revive a resolved or operator-controlled offer from old checkout attempts', () => {
    expect(unfinishedCheckout({ billingRecovery: { ...flag, required: false } }, seed)).toBeNull();
    expect(unfinishedCheckout({ billingRecovery: { ...flag, resolvedAt: '2026-10-01' } }, seed)).toBeNull();
    expect(unfinishedCheckout({ billingRecovery: { required: true, reason: 'manual' } }, seed)).toBeNull();
  });
});
