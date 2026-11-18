import type { UserRecord } from 'firebase-admin/auth';
import { unfinishedCheckout } from '../first-checkout';
import { auth, db } from '@/lib/firebase.admin';
import { listQaTrials, realEntitlement, type QaTrial } from '@/lib/qa-affiliate-run';
import {
  adminSubscriptionStatus,
  resolveAdminDisplayName,
  resolveMembershipState,
  type AdminMemberProjection,
} from './domain';
import { listAdminMembers } from './repository';

/**
 * Maximum number of billing documents read in a single batch.
 *
 * Firestore caps the keys of one batch read, so the billing documents are
 * read in chunks instead of one unbounded call.
 */
const BILLING_BATCH_SIZE = 100;

/**
 * Maximum number of authentication users returned per page.
 */
const AUTH_PAGE_SIZE = 1000;

type SourceData = Record<string, unknown>;

export interface AdminMemberSnapshot {
  /** Accounts that still exist in Firebase Authentication. */
  members: AdminMemberProjection[];
  /**
   * Projection rows whose Firebase account was deleted.
   *
   * They are kept out of the member list so a deleted account cannot be
   * mistaken for the live one, but they stay visible because a deleted
   * account can still hold a Stripe subscription that renews.
   */
  archived: AdminMemberProjection[];
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function tier(value: unknown): AdminMemberProjection['tier'] {
  return value === 'economy' || value === 'business' ? value : 'free';
}

function authCreationTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
}

/**
 * Lists every account that still exists in Firebase Authentication.
 *
 * The authentication list is the roster of real accounts: a projection row
 * whose account was deleted is a leftover, not a member.
 */
async function listAuthUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(AUTH_PAGE_SIZE, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

/**
 * Reads the member or billing documents for a batch of account IDs.
 *
 * `users/{uid}/billing/current` is the source of truth for the tier and the
 * subscription status. The `adminMembers` projection is only a snapshot of
 * it, so a dashboard that reads the projection shows whatever was true the
 * last time the member signed in.
 */
async function readMemberDocuments(
  uids: string[], source: 'billing' | 'member',
): Promise<Map<string, SourceData>> {
  const billing = new Map<string, SourceData>();

  for (let index = 0; index < uids.length; index += BILLING_BATCH_SIZE) {
    const chunk = uids.slice(index, index + BILLING_BATCH_SIZE);
    const references = chunk.map((uid) => db.doc(source === 'billing' ? `users/${uid}/billing/current` : `users/${uid}`));
    const snapshots = await db.getAll(...references);

    snapshots.forEach((snapshot, position) => {
      const uid = chunk[position];
      if (uid && snapshot.exists) {
        billing.set(uid, (snapshot.data() ?? {}) as SourceData);
      }
    });
  }

  return billing;
}

function buildMember(params: {
  uid: string;
  email: string;
  displayName: string;
  billing: SourceData | undefined;
  projection: AdminMemberProjection | undefined;
  member: SourceData | undefined;
  qaTrial: QaTrial | undefined;
  authCreatedAt: string;
  now: number;
}): AdminMemberProjection {
  const member = params.member ?? {};
  const qa = !realEntitlement(params.billing) && !realEntitlement(member) ? params.qaTrial : undefined;
  const billing = params.billing ?? {};
  const pending = !qa && unfinishedCheckout(member, billing);
  const subscriptionStatus = qa ? 'trialing' : adminSubscriptionStatus(billing);
  const cancelAtPeriodEnd = billing.cancelAtPeriodEnd === true;
  const trialStart = nullableNumber(billing.trialStart);
  const trialEnd = nullableNumber(billing.trialEnd);
  const currentPeriodEnd = nullableNumber(billing.currentPeriodEnd);

  return {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
    referredBy: nullableString(member.affiliateCode) ?? params.projection?.referredBy ?? qa?.affiliateCode ?? null,
    selectedTier: pending ? pending.choice?.tier ?? null : null,
    ...(qa ? { qaSimulation: true } : {}),
    tier: qa?.tier ?? tier(billing.tier),
    subscriptionStatus,
    membershipState: pending ? 'checkout_pending' : resolveMembershipState({
      status: subscriptionStatus,
      cancelAtPeriodEnd,
      trialStart,
      trialEnd,
      now: params.now,
    }),
    trialStart,
    trialEnd,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    cancelAt: nullableNumber(billing.cancelAt),
    customerId: nullableString(billing.customerId),
    subscriptionId: nullableString(billing.subscriptionId),
    priceId: nullableString(billing.priceId),
    authCreatedAt: params.authCreatedAt,
    createdAt: params.projection?.createdAt ?? params.authCreatedAt,
    updatedAt: params.projection?.updatedAt ?? params.authCreatedAt,
  };
}

/**
 * Builds the admin dashboard member list from live sources.
 *
 * The dashboard reads the same records the application does:
 *
 * - Firebase Authentication decides which accounts exist.
 * - `users/{uid}/billing/current` decides the tier, the status and the dates.
 * - `users/{uid}` decides the affiliate that brought the member in. The
 *   referral is read from the member itself and not from the projection, so
 *   it can never be a stale snapshot.
 * - The `adminMembers` projection only supplies the display name and the
 *   rows of accounts that were deleted outside the application.
 *
 * Reading the projection alone is what made the dashboard disagree with the
 * application: a member whose trial was re-opened kept a stale `canceled`
 * snapshot until the next sign-in or Stripe event refreshed it.
 *
 * @param now - Epoch seconds used to evaluate trial windows.
 * @returns The live members and the archived (deleted account) rows.
 */
export async function listAdminMemberSnapshot(
  now = Math.floor(Date.now() / 1000),
): Promise<AdminMemberSnapshot> {
  const [authUsers, projections] = await Promise.all([
    listAuthUsers(),
    listAdminMembers(),
  ]);

  const projectionByUid = new Map(
    projections.map((projection) => [projection.uid, projection] as const),
  );

  const liveUids = authUsers.map((user) => user.uid);
  const archivedUids = projections
    .map((projection) => projection.uid)
    .filter((uid) => !liveUids.includes(uid));

  const uids = [...liveUids, ...archivedUids];
  const [billing, memberDocuments, qaSimulations] = await Promise.all([
    readMemberDocuments(uids, 'billing'), readMemberDocuments(uids, 'member'), listQaTrials(),
  ]);

  const members: AdminMemberProjection[] = authUsers.map((user) => {
    const projection = projectionByUid.get(user.uid);
    const authCreatedAt = authCreationTime(
      user.metadata?.creationTime,
      projection?.authCreatedAt ?? new Date(now * 1000).toISOString(),
    );

    return buildMember({
      uid: user.uid,
      email: user.email ?? projection?.email ?? '',
      displayName: projection?.displayName
        ?? resolveAdminDisplayName(null, user.displayName),
      billing: billing.get(user.uid),
      projection,
      member: memberDocuments.get(user.uid),
      qaTrial: qaSimulations.get(user.uid),
      authCreatedAt,
      now,
    });
  });

  const archived: AdminMemberProjection[] = archivedUids.map((uid) => {
    const projection = projectionByUid.get(uid);

    return buildMember({
      uid,
      email: projection?.email ?? '',
      displayName: projection?.displayName ?? 'Actor',
      billing: billing.get(uid),
      projection,
      // An account whose member document is gone keeps its referral in the
      // projection, which is the only place it is left.
      member: memberDocuments.get(uid),
      qaTrial: qaSimulations.get(uid),
      authCreatedAt: projection?.authCreatedAt ?? new Date(now * 1000).toISOString(),
      now,
    });
  });

  return { members, archived };
}
