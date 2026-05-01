import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Edge Middleware to protect authenticated routes and enforce Role-Based Access Control.
 * Intercepts requests, cryptographically verifies the JWT, and blocks Economy users from premium routes.
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

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        
        // Verify the token AND extract the payload
        const verified = await jwtVerify(sessionCookie.value, secret, {
            issuer: 'kajabi-auth-callback',
            audience: 'kajabi-dashboard',
            algorithms: ['HS256'] 
        });

        // --- NEW: ROLE-BASED ACCESS CONTROL (RBAC) LOGIC ---
        const payload = verified.payload;
        const pathname = request.nextUrl.pathname;
        const isRestrictedPath = pathname.startsWith('/profile') || pathname.startsWith('/acting-coach');

        if (isRestrictedPath) {
            const userOffers = payload.offers as string[] | undefined;

            const economyOfferIds = new Set(
                (process.env.KAJABI_ECONOMY_OFFER_ID ?? '')
                    .split(',')
                    .map((offerId) => offerId.trim())
                    .filter((offerId) => offerId.length > 0)
            );

            // Failsafe: if the token doesn't have offers recorded, redirect to dashboard
            if (!userOffers || userOffers.length === 0) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // Configuration error: deny premium access if economy offer IDs are missing/empty
            if (economyOfferIds.size === 0) {
                console.error('[proxy] KAJABI_ECONOMY_OFFER_ID environment variable is not set or empty. Denying access to premium routes.');
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // The Lock: Checks if the user only has Economy-class plans, even if multiple Economy offers exist
            const hasOnlyEconomy = userOffers.every((offer) => economyOfferIds.has(offer));

            if (hasOnlyEconomy) {
                
                return NextResponse.redirect(new URL('/upgrade', request.url));
            }
        }
        // --- END RBAC LOGIC ---

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
        // NEW: Ensure the premium routes are intercepted
        '/profile/:path*',
        '/acting-coach/:path*',
    ],
};