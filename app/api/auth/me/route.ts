// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    // 1. Get the cookie store safely
    const cookieStore = await cookies();
    const token = cookieStore.get('kajabi_session')?.value;

    // 2. If no token, the user is not logged in
    if (!token) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    try {
        // 3. Ask Kajabi who this token belongs to
        // (You'll need to check Kajabi's API docs for the exact "me" endpoint)
        const response = await fetch(`${process.env.NEXT_PUBLIC_KAJABI_DOMAIN}/api/v1/users/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Invalid token");

        const userData = await response.json();
        
        // 4. Return the user data to our React frontend
        return NextResponse.json({ user: userData });
        
    } catch (error) {
        // If the token is expired or invalid, we clear it
        return NextResponse.json({ user: null }, { status: 401 });
    }
}