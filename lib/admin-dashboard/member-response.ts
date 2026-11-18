import type { AdminMemberProjection } from './domain';
import type { AdminMemberSnapshot } from './members';

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
  qaSimulation?: boolean;
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
    ...(member.qaSimulation ? { qaSimulation: true } : {}),
    tier: member.tier,
    subscriptionStatus: member.subscriptionStatus,
    membershipState: member.membershipState,
    trialEnd: member.trialEnd,
    currentPeriodEnd: member.currentPeriodEnd,
    cancelAtPeriodEnd: member.cancelAtPeriodEnd,
  };
}

function sortAdminMembers(
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
