import type { Firestore } from "firebase-admin/firestore";
import { AuditionSummary } from "../contracts";

export async function getUserAuditionsSummary(
  userPath: string,
  db: Firestore
): Promise<AuditionSummary[]> {
  const snapshot = await db
    .collection("users")
    .doc(userPath)
    .collection("auditions")
    .get();

  const auditions = snapshot.docs.map((doc) => ({
    id: doc.id,
    project: doc.data().project ?? "Unknown",
    role: doc.data().role ?? "Unknown",
    createdAt: doc.data().createdAt ?? "",
  }));

  return auditions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getAuditionFullData(
  userPath: string,
  auditionId: string,
  db: Firestore
): Promise<Record<string, unknown> | null> {
  const doc = await db.doc(`users/${userPath}/auditions/${auditionId}`).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as Record<string, unknown>;
}
