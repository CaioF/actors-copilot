import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/billing/currencies
 * Reports which currencies each configured Stripe Price can be charged in,
 * so the plan page never offers a checkout in an unsupported currency.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { getCheckoutCurrencySupport } = await import('@/lib/billing-currency');
    const support = await getCheckoutCurrencySupport();
    return NextResponse.json({ support });
  } catch (error) {
    logger.error({ err: error, msg: 'Failed to resolve Stripe currency support' });
    return NextResponse.json({ support: null, error: 'Currency support unavailable' }, { status: 503 });
  }
}
