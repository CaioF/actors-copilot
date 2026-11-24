import type { BillingCycle } from '@/lib/billing';

export class BlackFridayCheckoutError extends Error {}

export const BLACK_FRIDAY_CODE = 'BLACKFRIDAY';
export const BLACK_FRIDAY_START = Date.parse('2026-11-26T10:00:00Z');
export const BLACK_FRIDAY_END = Date.parse('2026-12-01T12:00:00Z');

export function isBlackFridayOpen(now: number): boolean {
  return now >= BLACK_FRIDAY_START && now < BLACK_FRIDAY_END;
}

export function isBlackFridayPlan(cycle: BillingCycle, currency: string | undefined): boolean {
  return cycle === 'annual' && (currency ?? 'usd') === 'usd';
}
