import type { UserRecord } from 'firebase-admin/auth';
import { auth, db } from '@/lib/firebase.admin';
import {
  adminSubscriptionStatus,
  resolveMembershipState,
  resolveAdminDisplayName,
  type AdminMemberProjection,
} from './domain';
import { getAdminMember, upsertAdminMember } from './repository';

export interface SyncAdminMemberOverrides {
  authUser?: UserRecord;
}

type SourceData = Record<string, unknown>;

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

export async function syncAdminMember(
  uid: string,
  overrides: SyncAdminMemberOverrides = {},
): Promise<AdminMemberProjection> {
  const actorProfilePromise = db.doc(`actorProfiles/${uid}`).get();
  const billingPromise = db.doc(`users/${uid}/billing/current`).get();
  const userPromise = db.doc(`users/${uid}`).get();
  const authUserPromise = overrides.authUser
    ? Promise.resolve(overrides.authUser)
    : auth.getUser(uid);

  const [authUser, actorProfile, billing, user, existing] = await Promise.all([
    authUserPromise,
    actorProfilePromise,
    billingPromise,
    userPromise,
    getAdminMember(uid),
  ]);

  const actorData: SourceData = actorProfile.exists
    ? (actorProfile.data() ?? {})
    : {};
  const billingData: SourceData = billing.exists ? (billing.data() ?? {}) : {};
  const userData: SourceData = user.exists ? (user.data() ?? {}) : {};
  const synchronizedAt = new Date().toISOString();
  const subscriptionStatus = adminSubscriptionStatus(billingData);
  const cancelAtPeriodEnd = billingData.cancelAtPeriodEnd === true;
  const trialStart = nullableNumber(billingData.trialStart);
  const trialEnd = nullableNumber(billingData.trialEnd);

  const member: AdminMemberProjection = {
    uid,
    email: authUser.email ?? '',
    displayName: resolveAdminDisplayName(
      nullableString(actorData.fullName),
      authUser.displayName,
    ),
    referredBy: nullableString(userData.affiliateCode),
    tier: tier(billingData.tier),
    subscriptionStatus,
    membershipState: resolveMembershipState({ status: subscriptionStatus, cancelAtPeriodEnd, trialStart, trialEnd }),
    trialStart,
    trialEnd,
    currentPeriodEnd: nullableNumber(billingData.currentPeriodEnd),
    cancelAtPeriodEnd,
    cancelAt: nullableNumber(billingData.cancelAt),
    customerId: nullableString(billingData.customerId),
    subscriptionId: nullableString(billingData.subscriptionId),
    priceId: nullableString(billingData.priceId),
    authCreatedAt: authCreationTime(
      authUser.metadata?.creationTime,
      synchronizedAt,
    ),
    createdAt: existing?.createdAt ?? synchronizedAt,
    updatedAt: synchronizedAt,
  };

  await upsertAdminMember(member);
  return member;
}
