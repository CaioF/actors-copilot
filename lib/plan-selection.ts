export type RequestedPlan = 'economy' | 'business';
export type RequestedCurrency = 'usd' | 'eur' | 'gbp';
export type DisplayBillingCycle = 'monthly' | 'annual';

export interface PlanSelection {
  plan: RequestedPlan;
  currency: RequestedCurrency;
}

export const SUPPORTED_CURRENCIES: readonly RequestedCurrency[] = ['usd', 'eur', 'gbp'];
export const DEFAULT_CURRENCY: RequestedCurrency = 'usd';

const PLAN_SELECTION_STORAGE_KEY = 'requested_plan_selection';

/**
 * Public website display prices. These are NOT proof that a Stripe price exists
 * in the given currency; purchasability is verified separately against Stripe.
 * Monthly values are charged per month; annual values are the full amount billed once per year
 * and must match the Stripe Payment Links in ANNUAL_PAYMENT_LINKS.
 */
const DISPLAY_PRICES: Record<DisplayBillingCycle, Partial<Record<RequestedCurrency, Record<RequestedPlan, number>>>> = {
  monthly: {
    usd: { economy: 19, business: 29 },
    eur: { economy: 17, business: 26 },
    gbp: { economy: 15, business: 22 },
  },
  annual: {
    usd: { economy: 190, business: 290 },
    eur: { economy: 170, business: 260 },
    gbp: { economy: 145, business: 220 },
  },
};

export const ANNUAL_PAYMENT_LINKS: Record<RequestedPlan, Record<RequestedCurrency, string>> = {
  economy: {
    usd: 'https://buy.stripe.com/9B628raU8aIOgQw0VYaZi0i',
    eur: 'https://buy.stripe.com/14A9AT1jy8AG57OawyaZi0j',
    gbp: 'https://buy.stripe.com/7sY7sL8M05oucAg346aZi0k',
  },
  business: {
    usd: 'https://buy.stripe.com/dRmeVd2nC6sy57O7kmaZi0l',
    eur: 'https://buy.stripe.com/8x23cv5zO2ci2ZG202aZi0m',
    gbp: 'https://buy.stripe.com/8x29AT5zO4kqas80VYaZi0n',
  },
};

/**
 * Builds the annual Stripe Payment Link for the exact plan + currency. The user id and email
 * are passed so the Stripe webhook can attach the subscription to the right account.
 */
export function getAnnualPaymentLink(
  plan: RequestedPlan,
  currency: RequestedCurrency,
  customer?: { uid?: string | null; email?: string | null }
): string {
  const url = new URL(ANNUAL_PAYMENT_LINKS[plan][currency]);
  if (customer?.uid) url.searchParams.set('client_reference_id', customer.uid);
  if (customer?.email) url.searchParams.set('prefilled_email', customer.email);
  return url.toString();
}

export function getAnnualMonthlyEquivalent(plan: RequestedPlan, currency: RequestedCurrency): number | null {
  const annual = getDisplayPrice(plan, currency, 'annual');
  return annual === null ? null : Math.round((annual / 12) * 100) / 100;
}

/** Largest whole-percent annual saving vs. 12 monthly payments, rounded down so it is never overstated. */
export function getMaxAnnualSavingsPercent(currency: RequestedCurrency): number | null {
  const plans: RequestedPlan[] = ['economy', 'business'];
  const savings = plans
    .map((plan) => {
      const monthly = getDisplayPrice(plan, currency, 'monthly');
      const annual = getDisplayPrice(plan, currency, 'annual');
      return monthly && annual ? (1 - annual / (monthly * 12)) * 100 : null;
    })
    .filter((value): value is number => value !== null && value > 0);
  return savings.length ? Math.floor(Math.max(...savings)) : null;
}

export function normalizePlan(raw: string | null | undefined): RequestedPlan | null {
  const value = raw?.trim().toLowerCase();
  return value === 'economy' || value === 'business' ? value : null;
}

export function normalizeCurrency(raw: string | null | undefined): RequestedCurrency | null {
  const value = raw?.trim().toLowerCase();
  return SUPPORTED_CURRENCIES.includes(value as RequestedCurrency) ? (value as RequestedCurrency) : null;
}

export function parsePlanSelection(
  plan: string | null | undefined,
  currency: string | null | undefined
): PlanSelection | null {
  const normalizedPlan = normalizePlan(plan);
  if (!normalizedPlan) return null;
  return { plan: normalizedPlan, currency: normalizeCurrency(currency) ?? DEFAULT_CURRENCY };
}

export function getDisplayPrice(
  plan: RequestedPlan,
  currency: RequestedCurrency,
  cycle: DisplayBillingCycle
): number | null {
  return DISPLAY_PRICES[cycle][currency]?.[plan] ?? null;
}

export function formatDisplayPrice(amount: number, currency: RequestedCurrency): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildUpgradeUrl(selection: PlanSelection | null): string {
  if (!selection) return '/upgrade';
  const params = new URLSearchParams({ plan: selection.plan, currency: selection.currency });
  return `/upgrade?${params.toString()}`;
}

export function savePlanSelection(selection: PlanSelection): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PLAN_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Storage can be unavailable (private mode); the URL still carries the selection.
  }
}

export function readPlanSelection(): PlanSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PLAN_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanSelection>;
    return parsePlanSelection(parsed.plan, parsed.currency);
  } catch {
    return null;
  }
}

export function clearPlanSelection(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PLAN_SELECTION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
