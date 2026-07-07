import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './lib/session';

/**
 * Protects authenticated routes by validating the active platform session and enforcing tier-based access rules.
 *
 * @param request - The incoming Next.js request object.
 * @returns The resulting Next.js response, either allowing the request through or redirecting to login or upgrade.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;
    const isRestrictedPath = pathname.startsWith('/profile') || pathname.startsWith('/acting-coach');
    const loginUrl = new URL('/login', request.url);
    const sessionToken = request.cookies.get('platform_session')?.value;

    if (!sessionToken) {
        return NextResponse.redirect(loginUrl);
    }

    const payload = await decryptSession(sessionToken);

    if (!payload) {
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('platform_session');
        return response;
    }

    if (isRestrictedPath && payload.tier !== 'business') {
        const activeStatuses = ['active', 'trialing'];
        const isSubscriptionActive = activeStatuses.includes(payload.subscriptionStatus);

        if (!isSubscriptionActive || payload.tier === 'economy' || payload.tier === 'free') {
            return NextResponse.redirect(new URL('/upgrade', request.url));
        }
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
        '/profile/:path*',
        '/acting-coach/:path*',
    ],
};