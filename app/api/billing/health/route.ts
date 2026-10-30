import { NextResponse } from 'next/server';
import { findStripePriceProblems } from '@/lib/stripe/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/health
 * Returns 200 when every configured Stripe Price is usable for checkout, 503 otherwise.
 */
export async function GET(): Promise<NextResponse> {
    try {
        const problems = await findStripePriceProblems();
        if (problems.length > 0) {
            logger.error({ msg: 'Stripe billing configuration is invalid', problems });
            return NextResponse.json({ ok: false, problems }, { status: 503 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        logger.error({ err: error, msg: 'Stripe billing health check failed' });
        return NextResponse.json({ ok: false, problems: ['Health check failed to run'] }, { status: 503 });
    }
}
