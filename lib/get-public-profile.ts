import { cache } from "react";
import { db } from "@/lib/firebase.admin";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Fetches a published actor profile by slug from Firestore.
 * Wrapped in React cache() to deduplicate calls within a single request
 * (used by both generateMetadata and the page component).
 */
export const getPublicProfile = cache(
  async (slug: string): Promise<(ActorProfile & { lastUpdated?: string }) | null> => {
    const snapshot = await db
      .collection("actorProfiles")
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();

    // Convert Firestore Timestamp to ISO string if present
    if (data.lastUpdated && typeof data.lastUpdated.toDate === "function") {
      data.lastUpdated = data.lastUpdated.toDate().toISOString();
    }
    if (data.publishedAt && typeof data.publishedAt.toDate === "function") {
      data.publishedAt = data.publishedAt.toDate().toISOString();
    }

    return data as ActorProfile & { lastUpdated?: string };
  }
);
