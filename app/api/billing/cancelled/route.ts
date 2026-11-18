import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getPlatformSession } from '@/lib/session';
import { db } from '@/lib/firebase.admin';
import { unfinishedCheckout } from '@/lib/first-checkout';

/**
 * Handles the Stripe Checkout cancel redirect.
 *
 * Stripe sends the member here when they leave Checkout. A first-time buyer
 * returns to the trial page. Other members return to the dashboard on the same host.
 *
 * @param req - Next.js incoming request for this route.
 * @returns The same-origin return to trial setup or the dashboard.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const sessionId = req.nextUrl.searchParams.get('session_id');
        logger.info(`Checkout cancelled by the member${sessionId ? ` [Session ID: ${sessionId}]` : ''}`);

        const session = await getPlatformSession();
        if (session?.tier === 'free' && !session.qaExpiresAt) {
            const [member, billing] = await Promise.all([
                db.doc(`users/${session.uid}`).get(), db.doc(`users/${session.uid}/billing/current`).get(),
            ]);
            if (unfinishedCheckout(member.data() ?? {}, billing.data() ?? {})) {
                return NextResponse.redirect(new URL('/start-trial', req.url));
            }
        }
        return NextResponse.redirect(new URL('/dashboard', req.url));
    } catch (error) {
        logger.error({ err: error, msg: 'Error handling the Stripe cancel redirect' });
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }
}
