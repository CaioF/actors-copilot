import { NextResponse } from 'next/server';
import { listAdminMemberSnapshot } from '@/lib/admin-dashboard/members';
import { buildAdminMembersResponse } from '@/lib/admin-dashboard/member-response';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' };

function errorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const code = (error as { code: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? code
    : undefined;
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: RESPONSE_HEADERS },
      );
    }

    const snapshot = await listAdminMemberSnapshot();
    const body = buildAdminMembersResponse(snapshot);

    return NextResponse.json(body, { headers: RESPONSE_HEADERS });
  } catch (error) {
    logger.error({
      route: '/api/admin/members',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      errorCode: errorCode(error),
    });
    return NextResponse.json(
      { error: 'Unable to load members' },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
}
