import { normalizeCurrency, type RequestedCurrency, type RequestedPlan, type DisplayBillingCycle } from './plan-selection';

type Fields = Record<string, unknown>;
export interface CheckoutChoice {
  tier: RequestedPlan;
  billingCycle: DisplayBillingCycle;
  currency: RequestedCurrency;
}

// Before #118 a newly created Stripe customer was also seeded with free/canceled.
// Real webhook and migration records have additional lifecycle fields.
const customerSeedFields = new Set(['customerId', 'tier', 'status', 'updatedAt', 'checkoutAttempt', 'hasUsedTrial']);
export function isCheckoutCustomerSeed(billing: Fields): boolean {
  return typeof billing.customerId === 'string' && billing.customerId.length > 0 &&
    (billing.tier === undefined || billing.tier === 'free') &&
    (billing.status === undefined || billing.status === 'canceled') && !billing.hasUsedTrial &&
    Object.keys(billing).every(field => customerSeedFields.has(field));
}

export function owesFirstTrial(member: Fields, billing: Fields): boolean {
  return ![member, billing].some(data =>
    data.hasUsedTrial === true || data.hasAccess === true || data.subscriptionId ||
    data.stripeSubscriptionId || data.priceId || data.trialStart || data.trialEnd ||
    data.currentPeriodEnd || data.subscriptionStatus || (data.tier && data.tier !== 'free')
  ) && (!member.status || isCheckoutCustomerSeed(member)) && (!billing.status || isCheckoutCustomerSeed(billing));
}

export function checkoutChoice(tier: unknown, cycle: unknown, currency: unknown): CheckoutChoice | null {
  const normalized = typeof currency === 'string' ? normalizeCurrency(currency) : null;
  if ((tier !== 'economy' && tier !== 'business') ||
      (cycle !== 'monthly' && cycle !== 'annual') || !normalized) return null;
  return { tier, billingCycle: cycle, currency: normalized };
}

/** A display and routing decision only. The selected tier never conveys access. */
export function unfinishedCheckout(member: Fields, billing: Fields): { choice: CheckoutChoice | null; awaitingSelection?: boolean } | null {
  if (!owesFirstTrial(member, billing)) return null;
  const flag = member.billingRecovery as Fields | undefined;
  if (flag) {
    if (flag.required !== true || flag.resolvedAt) return null;
    if (flag.reason === 'trial_selection') return { choice: null, awaitingSelection: true };
    if (flag.reason !== 'checkout_pending') return null;
    return { choice: checkoutChoice(flag.tier, flag.billingCycle, flag.currency) };
  }
  // A customer alone can be created even when Stripe fails before issuing Checkout.
  return isCheckoutCustomerSeed(billing) && Number.isSafeInteger(billing.checkoutAttempt) &&
    Number(billing.checkoutAttempt) > 0 ? { choice: null } : null;
}
