import { stripe } from './stripe';
import type { RequestedCurrency, RequestedPlan, DisplayBillingCycle } from './plan-selection';

export type CurrencySupportMap = Record<DisplayBillingCycle, Record<RequestedPlan, RequestedCurrency[]>>;

const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { value: CurrencySupportMap; expiresAt: number } | null = null;

function priceIdFor(plan: RequestedPlan, cycle: DisplayBillingCycle): string | undefined {
  if (plan === 'economy') {
    return cycle === 'annual' ? process.env.STRIPE_ECONOMY_ANNUAL_PRICE_ID : process.env.STRIPE_ECONOMY_PRICE_ID;
  }
  return cycle === 'annual' ? process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID : process.env.STRIPE_BUSINESS_PRICE_ID;
}

/**
 * Returns the currencies a configured Stripe Price can actually be charged in:
 * its base currency plus any multi-currency `currency_options`.
 * Returns an empty list when the price is not configured or cannot be retrieved.
 */
export async function getPriceCurrencies(priceId: string | undefined): Promise<RequestedCurrency[]> {
  if (!priceId) return [];
  const price = await stripe.prices.retrieve(priceId, { expand: ['currency_options'] });
  const currencies = new Set<string>([price.currency, ...Object.keys(price.currency_options ?? {})]);
  return (['usd', 'eur', 'gbp'] as RequestedCurrency[]).filter((c) => currencies.has(c));
}

export async function getCheckoutCurrencySupport(): Promise<CurrencySupportMap> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const plans: RequestedPlan[] = ['economy', 'business'];
  const cycles: DisplayBillingCycle[] = ['monthly', 'annual'];
  const value = { monthly: {}, annual: {} } as CurrencySupportMap;

  await Promise.all(
    cycles.flatMap((cycle) =>
      plans.map(async (plan) => {
        try {
          value[cycle][plan] = await getPriceCurrencies(priceIdFor(plan, cycle));
        } catch {
          value[cycle][plan] = [];
        }
      })
    )
  );

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
