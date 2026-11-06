/**
 * Shared read access to a member's saved auditions.
 *
 * My Auditions and Scene Study both read the same Firestore collection
 * (`users/{userPath}/auditions`). This module is the single place that knows
 * how to reach it, so both screens list the exact same records, apply the
 * exact same field normalization, and never drift apart.
 *
 * There is deliberately no second collection and no second copy of an
 * audition: the documents written by the wizard are the documents read here.
 */
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

import { getDb } from "@/lib/firebase";
import type { AuditionDocument } from "@/lib/audition-types";

export type AuditionStatus = "Completed" | "Processing" | "Draft";
export type ProjectType = "cinematic" | "commercial" | "theater";

/** A saved audition as the UI needs it. */
export interface SavedAuditionSummary {
  id: string;
  project: string;
  role: string;
  projectType: ProjectType;
  analysisType: "sides" | "brief";
  status: AuditionStatus;
  hasSides: boolean;
  hasBrief: boolean;
  castingDirectorName: string;
  createdAt: Date | null;
}

/**
 * Firestore path of the collection that holds a member's saved auditions.
 *
 * @param userPath - The member's private-data path segment.
 * @returns The collection path, e.g. `users/abc123_Jane/auditions`.
 */
export function auditionsCollectionPath(userPath: string): string {
  return `users/${userPath}/auditions`;
}

/**
 * Normalizes the stored status string into the badge label the UI shows.
 */
function normalizeStatus(raw: unknown): AuditionStatus {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  if (value === "completed") return "Completed";
  if (value === "processing") return "Processing";
  return "Draft";
}

/**
 * Converts a Firestore Timestamp (or a Date) into a plain Date.
 */
function toDate(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return null;
}

/**
 * Lists every audition the member has saved, newest first.
 *
 * This is the exact query My Auditions runs, so both screens show the same
 * set of records in the same order.
 *
 * @param userPath - The member's private-data path segment.
 * @returns The member's saved auditions, newest first.
 * @throws Whatever Firestore throws, so callers can surface an error state.
 */
export async function listSavedAuditions(userPath: string): Promise<SavedAuditionSummary[]> {
  const auditionsRef = collection(getDb(), auditionsCollectionPath(userPath));
  const snapshot = await getDocs(query(auditionsRef, orderBy("createdAt", "desc")));

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Partial<AuditionDocument> & Record<string, unknown>;
    const analysisType: "sides" | "brief" = data.analysisType === "brief" ? "brief" : "sides";

    return {
      id: docSnap.id,
      project: data.project || "Untitled Project",
      role: data.role || "Unknown Role",
      projectType:
        data.projectType === "commercial" || data.projectType === "theater"
          ? data.projectType
          : "cinematic",
      analysisType,
      status: normalizeStatus(data.status),
      hasSides: data.hasSides ?? analysisType === "sides",
      hasBrief: data.hasBrief ?? analysisType === "brief",
      castingDirectorName: data.castingDirectorName || "",
      createdAt: toDate(data.createdAt),
    };
  });
}

/**
 * Loads one saved audition in full — scene metadata and its stored breakdown.
 *
 * @param userPath - The member's private-data path segment.
 * @param auditionId - The id of the saved audition document.
 * @returns The stored audition, or null when it does not exist.
 */
export async function loadSavedAudition(
  userPath: string,
  auditionId: string
): Promise<AuditionDocument | null> {
  const docRef = doc(getDb(), `${auditionsCollectionPath(userPath)}/${auditionId}`);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docSnap.data() as AuditionDocument;
}
