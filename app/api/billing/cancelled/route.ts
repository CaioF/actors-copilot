import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Handles the Stripe Checkout cancel redirect.
 *
 * Stripe sends the member here when they abandon the payment. The app simply
 * returns them to the dashboard on the very same host, where the platform
 * middleware decides whether they need to sign in again.
 *
 * @param req - Next.js incoming request for this route.
 * @returns {Promise<NextResponse>} Redirect response to the application dashboard.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const sessionId = req.nextUrl.searchParams.get('session_id');
        logger.info(`Checkout cancelled by the member${sessionId ? ` [Session ID: ${sessionId}]` : ''}`);

        return NextResponse.redirect(new URL('/dashboard', req.url));
    } catch (error) {
        logger.error({ err: error, msg: 'Error handling the Stripe cancel redirect' });
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }
}
