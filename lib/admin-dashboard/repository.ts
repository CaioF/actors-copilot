import { db } from '@/lib/firebase.admin';
import type { AdminMemberProjection } from './domain';

const COLLECTION = 'adminMembers';

function toAdminMember(
  uid: string,
  data: Record<string, unknown>,
): AdminMemberProjection {
  return {
    uid,
    email: data.email as string,
    displayName: data.displayName as string,
    tier: data.tier as AdminMemberProjection['tier'],
    subscriptionStatus: data.subscriptionStatus as string | null,
    membershipState: data.membershipState as AdminMemberProjection['membershipState'],
    trialStart: data.trialStart as number | null,
    trialEnd: data.trialEnd as number | null,
    currentPeriodEnd: data.currentPeriodEnd as number | null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd as boolean,
    cancelAt: data.cancelAt as number | null,
    customerId: data.customerId as string | null,
    subscriptionId: data.subscriptionId as string | null,
    priceId: data.priceId as string | null,
    authCreatedAt: data.authCreatedAt as string,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  };
}

export async function getAdminMember(
  uid: string,
): Promise<AdminMemberProjection | null> {
  const snapshot = await db.doc(`${COLLECTION}/${uid}`).get();

  if (!snapshot.exists) {
    return null;
  }

  return toAdminMember(uid, snapshot.data() ?? {});
}

export async function listAdminMembers(): Promise<AdminMemberProjection[]> {
  const snapshot = await db.collection(COLLECTION).get();

  return snapshot.docs.map((document) =>
    toAdminMember(document.id, document.data()),
  );
}

export async function upsertAdminMember(
  member: AdminMemberProjection,
): Promise<void> {
  await db.doc(`${COLLECTION}/${member.uid}`).set(member, { merge: true });
}

export async function deleteAdminMember(uid: string): Promise<void> {
  await db.doc(`${COLLECTION}/${uid}`).delete();
}
