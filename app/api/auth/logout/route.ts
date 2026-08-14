import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { deletePlatformSession } from '@/lib/session';

/**
 * Clears the active platform session cookie during logout.
 *
 * @returns A JSON response confirming the session termination or reporting an error.
 */
export async function POST(): Promise<NextResponse> {
    try {
        await deletePlatformSession();
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error({ err: error, msg: 'Error during logout' });
        return NextResponse.json({ success: false, error: 'Failed to log out' }, { status: 500 });
    }
}