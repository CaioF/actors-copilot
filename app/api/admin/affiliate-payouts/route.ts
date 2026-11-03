import { NextResponse } from 'next/server';
import { listAffiliatePayouts, recordAffiliatePayout } from '@/lib/admin-dashboard/affiliates';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' };

/**
 * Returns the manual transfers already recorded.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const payouts = await listAffiliatePayouts();

    return NextResponse.json(payouts, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logger.error({
      route: '/api/admin/affiliate-payouts',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to load payouts' }, { status: 500, headers: RESPONSE_HEADERS });
  }
}

/**
 * Records a manual transfer to an affiliate.
 *
 * The record is what tells the next operator that the pending commission of a
 * period was already paid, so it keeps the method and the reference of the
 * transfer.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const body = (await req.json()) as {
      affiliateCode?: string;
      amount?: number;
      currency?: string;
      method?: string;
      reference?: string;
      note?: string;
      paidAt?: string;
    };

    if (!body.affiliateCode) {
      return NextResponse.json({ error: 'Missing affiliate code' }, { status: 400, headers: RESPONSE_HEADERS });
    }

    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'Invalid payout amount' }, { status: 400, headers: RESPONSE_HEADERS });
    }

    const payout = await recordAffiliatePayout({
      affiliateCode: body.affiliateCode,
      amount: body.amount,
      currency: body.currency ?? 'usd',
      method: body.method,
      reference: body.reference,
      note: body.note,
      paidAt: body.paidAt,
    });

    return NextResponse.json(payout, { status: 200, headers: RESPONSE_HEADERS });
  } catch (error) {
    logger.error({
      route: '/api/admin/affiliate-payouts',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to record payout' }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
