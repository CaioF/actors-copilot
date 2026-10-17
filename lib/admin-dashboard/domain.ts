export type AdminMembershipState =
  | 'trial'
  | 'paid'
  | 'paid_cancelling'
  | 'past_due'
  | 'paused'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'canceled'
  | 'no_plan'
  | 'inactive';

export interface AdminMemberProjection {
  uid: string;
  email: string;
  displayName: string;
  tier: 'free' | 'economy' | 'business';
  subscriptionStatus: string | null;
  membershipState: AdminMembershipState;
  trialStart: number | null;
  trialEnd: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  authCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function classifyMembership(
  status: string | null | undefined,
  cancelAtPeriodEnd = false,
): AdminMembershipState {
  switch (status) {
    case undefined:
    case null:
      return 'no_plan';
    case 'trialing':
      return 'trial';
    case 'active':
      return cancelAtPeriodEnd ? 'paid_cancelling' : 'paid';
    case 'past_due':
    case 'paused':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    case 'canceled':
      return status;
    default:
      return 'inactive';
  }
}

export function resolveAdminDisplayName(
  actorFullName: string | null | undefined,
  authDisplayName: string | null | undefined,
): string {
  return actorFullName?.trim() || authDisplayName?.trim() || 'Actor';
}
