import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { deletePlatformSession } from '@/lib/session'; // Centralized session management helper

/**
 * Handles user logout by destroying secure HTTP-only session cookies.
 * This server-side action is strictly required because client-side JavaScript 
 * is blocked from accessing or deleting httpOnly cookies to prevent XSS attacks.
 *
 * @returns {Promise<NextResponse>} A JSON response confirming the session termination or an error status.
 */
export async function POST(): Promise<NextResponse> {
    try {
        // TODO: Implement an event logger or analytics tracking here to monitor user logout frequencies.
        // TODO: If transitioning to stateful sessions or token blacklisting in the future, add logic here to invalidate the JWT in Redis/Database.
        
        // 1. Purge the modern Stripe-backed platform session using the shared helper
        await deletePlatformSession();
        
        // 2. Legacy fallback cleanup to prevent stray active tokens during rollout periods
        const cookieStore = await cookies();
        cookieStore.delete('kajabi_session');
        
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error({ err: error, msg: 'Error during logout' });
        return NextResponse.json({ success: false, error: 'Failed to log out' }, { status: 500 });
    }
}