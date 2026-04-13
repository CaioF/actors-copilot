import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Handles user logout by destroying the secure HTTP-only session cookie.
 * This server-side action is strictly required because client-side JavaScript 
 * is blocked from accessing or deleting httpOnly cookies to prevent XSS attacks.
 *
 * @returns {Promise<NextResponse>} A JSON response confirming the session termination or an error status.
 */
export async function POST() {
    try {
        // TODO: Implement an event logger or analytics tracking here to monitor user logout frequencies.
        // TODO: If transitioning to stateful sessions or token blacklisting in the future, add logic here to invalidate the JWT in Redis/Database.
        
        const cookieStore = await cookies();
        
        // Destroys the session cookie, effectively logging the user out on the backend
        cookieStore.delete('kajabi_session');
        
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error({ err: error, msg: 'Error during logout' });
        return NextResponse.json({ success: false, error: 'Failed to log out' }, { status: 500 });
    }
}