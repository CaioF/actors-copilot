import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Edge Middleware to protect authenticated routes.
 * Intercepts requests to restricted paths, cryptographically verifies the JWT session cookie,
 * and redirects unauthenticated or tampered requests back to the login page.
 *
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} The Next.js response (proceeds to route or redirects).
 */
export async function proxy(request: NextRequest) {
    const sessionCookie = request.cookies.get('kajabi_session');

    const loginUrl = new URL('/login', request.url);

    if (!sessionCookie) {
        return NextResponse.redirect(loginUrl);
    }

    try {
        if (!process.env.JWT_SECRET) {
            console.error('[proxy] JWT_SECRET environment variable is not set. Redirecting to login.');
            return NextResponse.redirect(loginUrl);
        }

        // TODO: Implement token rotation or a silent refresh mechanism to handle expiring sessions seamlessly.
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        
        // Verify the token AND enforce the claims we set during creation
        await jwtVerify(sessionCookie.value, secret, {
            issuer: 'kajabi-auth-callback',
            audience: 'kajabi-dashboard',
            algorithms: ['HS256'] // Restricting allowed algorithms as suggested
        });
    } catch (error) {
        // If the token is invalid, manipulated, or expired, destroy the cookie and force a new login
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('kajabi_session');
        return response;
    }

    return NextResponse.next();
}

/**
 * Next.js Edge Middleware configuration.
 * Defines the URL patterns that should be intercepted and protected by this proxy.
 */
export const config = {
    matcher: [
        '/dashboard/:path*',
        '/chat/:path*',
        '/auditions/:path*',
        '/personal-dna/:path*',
        '/settings/:path*',
    ],
};