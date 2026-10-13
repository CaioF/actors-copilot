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
 * Annual prices are only defined where the app already had them configured (USD).
 */
const DISPLAY_PRICES: Record<DisplayBillingCycle, Partial<Record<RequestedCurrency, Record<RequestedPlan, number>>>> = {
  monthly: {
    usd: { economy: 19, business: 29 },
    eur: { economy: 17, business: 26 },
    gbp: { economy: 14, business: 22 },
  },
  annual: {
    usd: { economy: 15, business: 23 },
  },
};

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
