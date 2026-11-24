import type { BillingCycle, SubscriptionTier } from '@/lib/billing';
import {
  BLACK_FRIDAY_CODE,
  BlackFridayCheckoutError,
  isBlackFridayOpen,
  isBlackFridayPlan,
} from '@/lib/black-friday';
import { stripe } from '@/lib/stripe';

const COUPONS = {
  economy: 'blackfriday-2026-economy-annual',
  business: 'blackfriday-2026-business-annual',
} as const;

const FIRST_ANNUAL_ONLY = 'BLACKFRIDAY is available for your first annual subscription.';

export function validateBlackFridayCode(
  value: unknown,
  cycle: BillingCycle,
  currency: string | undefined,
): boolean {
  if (value === undefined || (typeof value === 'string' && !value.trim())) return false;
  if (typeof value !== 'string' || value.trim().toUpperCase() !== BLACK_FRIDAY_CODE) {
    throw new BlackFridayCheckoutError('That promo code was not recognised. Other codes can be entered at Stripe Checkout.');
  }
  if (!isBlackFridayOpen(Date.now())) {
    throw new BlackFridayCheckoutError('BLACKFRIDAY is outside its redemption window.');
  }
  if (!isBlackFridayPlan(cycle, currency)) {
    throw new BlackFridayCheckoutError('BLACKFRIDAY applies to annual subscriptions in USD.');
  }
  return true;
}

export async function resolveBlackFridayCoupon(
  customer: string,
  tier: Exclude<SubscriptionTier, 'free'>,
): Promise<string> {
  for await (const subscription of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
    if (subscription.items.data.some(({ price }) => price.recurring?.interval === 'year')) {
      throw new BlackFridayCheckoutError(FIRST_ANNUAL_ONLY);
    }
  }
  return COUPONS[tier];
}
