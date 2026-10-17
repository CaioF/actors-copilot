import { NextResponse } from 'next/server';
import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';
import { listAdminMembers } from '@/lib/admin-dashboard/repository';
import { getAdminSession } from '@/lib/admin-dashboard/session';
import { logger } from '@/lib/logger';

const RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store' };
const memberCollator = new Intl.Collator('en', { sensitivity: 'base' });

export type AdminMemberDto = Pick<
  AdminMemberProjection,
  | 'uid'
  | 'displayName'
  | 'email'
  | 'tier'
  | 'subscriptionStatus'
  | 'membershipState'
  | 'trialEnd'
  | 'currentPeriodEnd'
  | 'cancelAtPeriodEnd'
>;

export function serializeAdminMember(
  member: AdminMemberProjection,
): AdminMemberDto {
  return {
    uid: member.uid,
    displayName: member.displayName,
    email: member.email,
    tier: member.tier,
    subscriptionStatus: member.subscriptionStatus,
    membershipState: member.membershipState,
    trialEnd: member.trialEnd,
    currentPeriodEnd: member.currentPeriodEnd,
    cancelAtPeriodEnd: member.cancelAtPeriodEnd,
  };
}

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

    const members = await listAdminMembers();
    const body = [...members]
      .sort((left, right) =>
        memberCollator.compare(left.displayName, right.displayName)
        || memberCollator.compare(left.email, right.email)
        || memberCollator.compare(left.uid, right.uid))
      .map(serializeAdminMember);

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
