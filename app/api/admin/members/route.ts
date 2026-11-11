import { NextResponse } from 'next/server';
import type { AdminMemberProjection } from '@/lib/admin-dashboard/domain';
import {
  listAdminMemberSnapshot,
  type AdminMemberSnapshot,
} from '@/lib/admin-dashboard/members';
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
> & {
  /** The affiliate code that brought this member in, when there is one. */
  referredBy: string | null;
};

export interface AdminMembersResponse {
  members: AdminMemberDto[];
  archived: AdminMemberDto[];
}

export function serializeAdminMember(
  member: AdminMemberProjection,
): AdminMemberDto {
  return {
    uid: member.uid,
    displayName: member.displayName,
    email: member.email,
    referredBy: member.referredBy ?? null,
    tier: member.tier,
    subscriptionStatus: member.subscriptionStatus,
    membershipState: member.membershipState,
    trialEnd: member.trialEnd,
    currentPeriodEnd: member.currentPeriodEnd,
    cancelAtPeriodEnd: member.cancelAtPeriodEnd,
  };
}

export function sortAdminMembers(
  members: AdminMemberProjection[],
): AdminMemberProjection[] {
  return [...members].sort((left, right) =>
    memberCollator.compare(left.displayName, right.displayName)
    || memberCollator.compare(left.email, right.email)
    || memberCollator.compare(left.uid, right.uid));
}

/**
 * Builds the public payload of the member list.
 *
 * The dashboard page and the API render the same list, so both go through
 * this builder: one sort order and one field allowlist.
 */
export function buildAdminMembersResponse(
  snapshot: AdminMemberSnapshot,
): AdminMembersResponse {
  return {
    members: sortAdminMembers(snapshot.members).map((member) =>
      serializeAdminMember(member),
    ),
    archived: sortAdminMembers(snapshot.archived).map((member) =>
      serializeAdminMember(member),
    ),
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
