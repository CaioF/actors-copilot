import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { decryptSession } from './lib/session';
import { decryptAdminSession } from './lib/admin-dashboard/session';

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
    const loginUrl = new URL('/login', request.url);
    const upgradeUrl = new URL('/upgrade', request.url);

    // Identificação de caminhos específicos para controle de acesso granular
    const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
    const isBusinessFeaturePath = pathname.startsWith('/profile') || pathname.startsWith('/acting-coach');
    const isBillingSuccessPath = pathname === '/api/billing/success' || pathname.startsWith('/api/billing/success/');

    const isAdminDashboardPath = pathname === '/admin-dashboard' || pathname.startsWith('/admin-dashboard/');
    const isAdminApiPath = pathname === '/api/admin' || pathname.startsWith('/api/admin/');

    if (isAdminDashboardPath || pathname === '/api/admin/login') {
        return NextResponse.next();
    }

    if (isAdminApiPath) {
        const adminToken = request.cookies.get('admin_session')?.value;
        const adminSession = adminToken ? await decryptAdminSession(adminToken) : null;

        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.next();
    }

    if (isBillingSuccessPath) {
        return NextResponse.next();
    }

    // =========================================================================
    // 1. MODERN STRIPE ARCHITECTURE EXPRESS ROUTE
    // =========================================================================
    if (BILLING_ENGINE === 'STRIPE') {
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

        const userTier = payload.tier || 'free';
        const activeStatuses = ['active', 'trialing'];
        const isSubscriptionActive = activeStatuses.includes(payload.subscriptionStatus);

        if (userTier === 'free' || !isSubscriptionActive) {
            if (!isDashboardPath) {
                return NextResponse.redirect(upgradeUrl);
            }
            return NextResponse.next();
        }

        if (userTier === 'economy') {
            if (isBusinessFeaturePath) {
                return NextResponse.redirect(upgradeUrl);
            }
            return NextResponse.next();
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

        if (pathname.startsWith('/profile') || pathname.startsWith('/acting-coach')) {
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
                return NextResponse.redirect(upgradeUrl);
            }
        }

    } catch {
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('kajabi_session');
        return response;
    }

    return NextResponse.next();
}

/**
 * Next.js Edge Middleware configuration.
 */
export const config = {
    matcher: [
        '/admin-dashboard/:path*',
        '/api/admin/:path*',
        '/api/billing/success',
        '/dashboard/:path*',
        '/chat/:path*',
        '/auditions/:path*',
        '/personal-dna/:path*',
        '/settings/:path*',
        '/profile/:path*',
        '/acting-coach/:path*',
    ],
};
