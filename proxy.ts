import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {jwtVerify} from 'jose';

export async function proxy(request: NextRequest) {
    const sessionCookie = request.cookies.get('kajabi_session');

    const loginUrl = new URL('/login', request.url);

    if (!sessionCookie) {
        return NextResponse.redirect(loginUrl);
    }

    try {
        if (!process.env.JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is missing. Server misconfigured.");
            return NextResponse.redirect(loginUrl);
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        // jwtVerify checks if the token was tampered with or expired.
        // If it's fake, this line will throw an error and jump to the catch block.
        await jwtVerify(sessionCookie.value, secret);
    } catch (error) {
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('kajabi_session');
        return response;
    }


    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard',
        '/dashboard/:path*',
    ],
};