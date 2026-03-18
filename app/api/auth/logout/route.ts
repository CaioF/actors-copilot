import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete('kajabi_session');
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error("Error during logout: ", error);
        return NextResponse.json({ success: false, error: 'Failed to log out' }, { status: 500 });
    }
}