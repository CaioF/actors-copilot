import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { decryptSession } from './lib/session';

/**
 * Active billing engine core descriptor feature flag.
 */
const BILLING_ENGINE = process.env.BILLING_ENGINE || 'STRIPE';

/**
 * Edge Middleware to protect authenticated routes and enforce Tier-Based Access Control.
 * Intercepts requests, cryptographically verifies the platform JWT, and shifts users to upgrade funnels.
 *
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} The Next.js response (proceeds to route or redirects).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;
    const isRestrictedPath = pathname.startsWith('/profile') || pathname.startsWith('/acting-coach');
    const loginUrl = new URL('/login', request.url);

    // =========================================================================
    // 1. MODERN STRIPE ARCHITECTURE EXPRESS ROUTE
    // =========================================================================
    if (BILLING_ENGINE === 'STRIPE') {
        const sessionToken = request.cookies.get('platform_session')?.value;

        if (!sessionToken) {
            return NextResponse.redirect(loginUrl);
        }

        const payload = await decryptSession(sessionToken);

        // If the token is invalid, manipulated, or expired, destroy the cookie and force a new login
        if (!payload) {
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('platform_session');
            return response;
        }

        // Gate access to business-tier premium features dynamically
        if (isRestrictedPath && payload.tier !== 'business') {
            const activeStatuses = ['active', 'trialing'];
            const isSubscriptionActive = activeStatuses.includes(payload.subscriptionStatus);

            // Gracefully route past-due or low-tier accounts to product acquisition funnels
            if (!isSubscriptionActive || payload.tier === 'economy' || payload.tier === 'free') {
                return NextResponse.redirect(new URL('/upgrade', request.url));
            }
        }

        return NextResponse.next();
    }

    // =========================================================================
    // 2. LEGACY KAJABI ARCHITECTURE FALLBACK ROUTE
    // =========================================================================
    const legacyCookie = request.cookies.get('kajabi_session');

    if (!legacyCookie) {
        return NextResponse.redirect(loginUrl);
    }

    try {
        const jwtSecret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('[proxy] JWT_SECRET encryption target is unconfigured.');
            return NextResponse.redirect(loginUrl);
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const verified = await jwtVerify(legacyCookie.value, secret, {
            algorithms: ['HS256']
        });

        const payload = verified.payload;

        if (isRestrictedPath) {
            const userOffers = payload.offers as string[] | undefined;
            const economyOfferIds = new Set(
                (process.env.KAJABI_ECONOMY_OFFER_ID ?? '')
                    .split(',')
                    .map((id) => id.trim())
                    .filter((id) => id.length > 0)
            );

            if (!userOffers || userOffers.length === 0) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            if (economyOfferIds.size === 0) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            const hasOnlyEconomy = userOffers.every((offer) => economyOfferIds.has(offer));
            if (hasOnlyEconomy) {
                return NextResponse.redirect(new URL('/upgrade', request.url));
            }
        }

    } catch (error) {
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
        '/profile/:path*',
        '/acting-coach/:path*',
    ],
};