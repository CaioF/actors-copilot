import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('kajabi_session')?.value;

        // no cookie means no session, so the user is not authenticated
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Security check: ensure JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            console.error("[Auth] CRITICAL: JWT_SECRET missing in /me route");
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Uncrypt (JWT)
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(sessionCookie, secret);

        return NextResponse.json({ 
            user: { email: payload.email } 
        }, { status: 200 });

    } catch (error) {
        console.error("Error verifying session in /me:", error);
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }
}