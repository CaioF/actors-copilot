import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { deleteAdminSession } from '@/lib/admin-dashboard/session';

export async function POST(): Promise<NextResponse> {
  try {
    await deleteAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({
      route: '/api/admin/logout',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }, 'Admin logout failed');
    return NextResponse.json({ error: 'Unable to log out' }, { status: 500 });
  }
}
