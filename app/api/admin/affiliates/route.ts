import { NextResponse } from 'next/server';
import { buildAffiliateReport, upsertAffiliate } from '@/lib/admin-dashboard/affiliates';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' };

/**
 * Returns the commission report of every affiliate.
 *
 * The report joins the attributed accounts with what they actually paid, so it
 * is only available to an authenticated operator.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const report = await buildAffiliateReport();

    return NextResponse.json(report, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logger.error({
      route: '/api/admin/affiliates',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to load affiliates' }, { status: 500, headers: RESPONSE_HEADERS });
  }
}

/**
 * Creates or updates an affiliate.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: RESPONSE_HEADERS });
    }

    const body = (await req.json()) as {
      code?: string;
      name?: string;
      email?: string;
      rate?: number;
      active?: boolean;
      notes?: string;
    };

    if (!body.code) {
      return NextResponse.json({ error: 'Missing affiliate code' }, { status: 400, headers: RESPONSE_HEADERS });
    }

    const affiliate = await upsertAffiliate({
      code: body.code,
      name: body.name,
      email: body.email,
      rate: body.rate,
      active: body.active,
      notes: body.notes,
    });

    return NextResponse.json(affiliate, { status: 200, headers: RESPONSE_HEADERS });
  } catch (error) {
    logger.error({
      route: '/api/admin/affiliates',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to save affiliate' }, { status: 500, headers: RESPONSE_HEADERS });
  }
}
