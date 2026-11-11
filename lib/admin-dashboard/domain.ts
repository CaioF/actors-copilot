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
  /** The affiliate code that brought this member in, when there is one. */
  referredBy?: string | null;
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

export interface MembershipStateInput {
  status: string | null | undefined;
  cancelAtPeriodEnd?: boolean;
  trialStart?: number | null;
  trialEnd?: number | null;
  /** Epoch seconds used to evaluate the trial window. Defaults to now. */
  now?: number;
}

/**
 * Reports whether a trial window is still open for the member.
 *
 * @param trialStart - Epoch seconds when the trial started, when known.
 * @param trialEnd - Epoch seconds when the trial ends, when known.
 * @param now - Epoch seconds to evaluate the window against.
 * @returns True while the member is inside the trial period.
 */
export function isTrialWindowOpen(
  trialStart: number | null | undefined,
  trialEnd: number | null | undefined,
  now: number,
): boolean {
  if (typeof trialEnd !== 'number' || !Number.isFinite(trialEnd)) {
    return false;
  }

  if (trialEnd <= now) {
    return false;
  }

  if (typeof trialStart === 'number' && Number.isFinite(trialStart) && trialStart > now) {
    return false;
  }

  return true;
}

/**
 * Resolves the membership state shown by the admin dashboard.
 *
 * The Stripe status is the primary signal, but an open trial window wins over
 * a stored `active` status: the Stripe webhook promotes a trialing
 * subscription to `active` when the $0 trial invoice is paid, so the stored
 * status alone would report a trial as a paid plan. The trial window is the
 * fact that survives that promotion.
 *
 * @param input - Stored status, cancellation flag and trial window.
 * @returns The membership state to render.
 */
export function resolveMembershipState(
  input: MembershipStateInput,
): AdminMembershipState {
  const {
    status,
    cancelAtPeriodEnd = false,
    trialStart = null,
    trialEnd = null,
  } = input;
  const now = input.now ?? Math.floor(Date.now() / 1000);

  if (status === 'trialing') {
    return 'trial';
  }

  if (
    status === 'active'
    && isTrialWindowOpen(trialStart, trialEnd, now)
  ) {
    return 'trial';
  }

  return classifyMembership(status, cancelAtPeriodEnd);
}

export function resolveAdminDisplayName(
  actorFullName: string | null | undefined,
  authDisplayName: string | null | undefined,
): string {
  return actorFullName?.trim() || authDisplayName?.trim() || 'Actor';
}
