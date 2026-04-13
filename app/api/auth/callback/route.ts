import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/firebase.admin';
import { SignJWT } from 'jose';
import { logger, createChildLogger } from '@/lib/logger';

/**
 * Authenticates a user via Firebase, verifies their Kajabi access, 
 * and establishes a secure session by issuing an HTTP-only JWT cookie.
 *
 * @param {Request} request - The incoming HTTP request containing the Firebase Bearer token.
 * @returns {Promise<NextResponse>} A JSON response indicating success with a redirect URL, or an error status and message.
 */
export async function POST(request: Request) {
    const log = createChildLogger({ route: 'auth-callback' });
    // TODO: Implement rate limiting (e.g., Upstash Redis) to prevent brute-force attacks on this endpoint.
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            log.warn({ msg: 'Missing or invalid Authorization header' });
            return NextResponse.json({ error: 'Token not found or invalid' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Decode the Firebase token to extract the email for Kajabi validation
        const decodedToken = await auth.verifyIdToken(idToken);
        const userEmail = decodedToken.email;

        if (!userEmail) {
            log.warn({ msg: 'Email not found in token' });
            return NextResponse.json({ error: 'Email not found in token' }, { status: 400 });
        }
        
        const hasAccess = await verifyKajabiPurchase(userEmail);
        
        if (!hasAccess.success) {
            // Forward the exact Kajabi validation error message to the frontend
            log.error({ email: userEmail, message: hasAccess.message, msg: 'Kajabi validation failed' });
            
            // Check if it's an actual env configuration error vs a user access denial
            const isConfigError = hasAccess.message?.includes("System configuration error");
            const statusCode = isConfigError ? 500 : 403;

            return NextResponse.json(  
                { error: hasAccess.message || 'Access denied by Kajabi validation.' },  
                { status: statusCode }  
            );  
        }

        // Cryptographically sign a new JWT containing the user's email to establish a session
        if (!process.env.JWT_SECRET) {
            log.error({ msg: 'JWT_SECRET not configured' });
            return NextResponse.json({ error: 'Internal Configuration Error' }, { status: 500 });
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_for_dev');
        
        // Define standard claims for defense-in-depth security
        const issuer = 'kajabi-auth-callback';
        const audience = 'kajabi-dashboard';

        const token = await new SignJWT({ email: userEmail })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer(issuer)
            .setAudience(audience)
            .setSubject(decodedToken.uid)
            .setExpirationTime('24h')
            .sign(secret);

        // Store the signed JWT in a secure, HTTP-only cookie
        const cookieStore = await cookies();
        cookieStore.set('kajabi_session', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'strict', 
            maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
            path: '/', 
        });

        log.info({ email: userEmail, msg: 'Authentication successful' });
        return NextResponse.json({ success: true, redirectUrl: '/dashboard' }, { status: 200 });

    } catch (error) {
        log.error({ err: error, msg: 'Authentication error' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
} 

/**
 * Validates the user's purchase history against the Kajabi API using Client Credentials.
 *
 * @param {string} email - The user's authenticated email address from Firebase.
 * @returns {Promise<{ success: boolean; message?: string }>} An object containing the verification result and an optional user-facing error message.
 */
async function verifyKajabiPurchase(email: string): Promise<{ success: boolean; message?: string }> {
    // TODO: Implement an LRU cache or Redis for the Kajabi access token to avoid requesting a new OAuth token on every login.
    // TODO: Consider adding a retry mechanism for Kajabi API timeouts to improve reliability.

    const clientId = process.env.KAJABI_CLIENT_ID;
    const clientSecret = process.env.KAJABI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return { success: false, message: "System configuration error. Please contact support." };
    }

    try {
        const tokenResponse = await fetch('https://api.kajabi.com/v1/oauth/token',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            })
        });

        if (!tokenResponse.ok) return { success: false, message: "Failed to connect to Kajabi validation server." };

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch(`https://api.kajabi.com/v1/contacts?email=${encodeURIComponent(email)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        if (!userResponse.ok) return { success: false, message: "Failed to fetch user data from Kajabi." };

        const userData = await userResponse.json();
        if (!userData || !userData.data || userData.data.length === 0 ) {
            return { success: false, message: "We couldn't find a Kajabi account with this email. Please use the exact email you used to purchase." };
        }

        const userInKajabi = userData.data.find(
            (contato: any) => contato.attributes.email === email
        );

        if (!userInKajabi) {
            return { success: false, message: "Email not found in our members list. Are you using the right Google Account?" };
        }

        const offerUrl = userInKajabi.relationships.offers?.links.self;

        if (!offerUrl) {
            return { success: false, message: "Your account was found, but you don't have any active purchases." };
        }

        const offersResponse = await fetch(offerUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        if (!offersResponse.ok) return { success: false, message: "Failed to verify your active offers." }; 

        const offersData = await offersResponse.json();
        if (!offersData.data || offersData.data.length === 0) {
            return { success: false, message: "You don't have any active offers in your account." };
        }

        const requiredOfferId = process.env.KAJABI_REQUIRED_OFFER_ID;
        if (!requiredOfferId) {
            return { success: false, message: "An unexpected error occurred during validation. Please try again." };
        }
        
        const hasRequiredOffer = offersData.data.some(
            (offer: any) => String(offer.id) === String(requiredOfferId)
        );

        if (!hasRequiredOffer) {
            return { success: false, message: "You don't have the required 'The Actor's Copilot' offer. Please check your purchase history." };
        }
        
        return { success: true, message: "Purchase verified successfully." };

    } catch (error) {
        logger.error({ err: error, email, msg: 'Error verifying Kajabi purchase' });
        return { success: false, message: "An unexpected error occurred during validation. Please try again." };
    }
}