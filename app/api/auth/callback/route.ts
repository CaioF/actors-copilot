import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // 1. extract the authorization code from the query parameters
    // When Kajabi sends the user back, the URL will look like: 
    // http://localhost:3000/api/auth/callback?code=abc123xyz
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // If there is no code, something went wrong (e.g., user denied access)
    if (!code) {
        console.error("No authorization code provided by Kajabi");
        return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
    }

    try {
        // 2. exchange the code for an access token
        const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_KAJABI_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.NEXT_PUBLIC_KAJABI_CLIENT_ID,
                client_secret: process.env.KAJABI_CLIENT_SECRET, // Safe server-side secret
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.NEXT_PUBLIC_KAJABI_REDIRECT_URI,
            }),
        });

        const tokenData = await tokenResponse.json();
        console.log("=== KAJABI TOKEN DATA ===", tokenData);

        if (!tokenResponse.ok) {
            throw new Error(tokenData.error_description || "Failed to exchange token");
        }

        // 3. SEND THE USER TO THE DASHBOARD
        // having the access_token, redirect the user to the frontend dashboard.
        // secure, HttpOnly cookie
        // This is invisible to the URL and protected from malicious JavaScript
        const cookieStore = await cookies();

        cookieStore.set({
            name: 'kajabi_session',
            value: tokenData.access_token,
            httpOnly: true, // Crucial: prevents XSS attacks
            secure: process.env.NODE_ENV === 'production', // Only sends over HTTPS in production
            sameSite: 'lax', // CSRF protection
            path: '/', // The cookie is valid for the whole website
            maxAge: 60 * 60 * 24 * 7 // E.g., 7 days in seconds
        })
        
        return NextResponse.redirect(new URL('/dashboard', request.url));

    } catch (error) {
        console.error("Token exchange failed:", error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
}

