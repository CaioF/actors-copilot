/**
 * Infrastructure utility for Firebase Storage maintenance.
 * Handles the deletion of showreel video files and their associated thumbnails.
 * * Implementation details:
 * - Uses Promise.allSettled to ensure that a failure in deleting a thumbnail 
 *   does not block the primary video file deletion.
 * - Guards against non-Firebase URLs (e.g., YouTube/Vimeo) to prevent SDK errors.
 */
import { logger } from "@/lib/logger";

export async function deleteShowreelFile(showreel: { url: string; thumbnailUrl?: string }): Promise<void> {
  const { getStorage, ref, deleteObject } = await import("firebase/storage");
  const { getDb } = await import("@/lib/firebase");
  const storage = getStorage();

  const deletionPromises: Promise<void>[] = [];

  /**
   * Helper to identify if a URL points to our Firebase Storage bucket.
   * Manually pasted URLs (YouTube, Vimeo) are ignored by the storage cleanup logic.
   */
  const isFirebaseUrl = (url: string) => url.includes("firebasestorage.googleapis.com");

  if (showreel.url && isFirebaseUrl(showreel.url)) {
    const videoRef = ref(storage, showreel.url);
    deletionPromises.push(deleteObject(videoRef));
  }

  if (showreel.thumbnailUrl && isFirebaseUrl(showreel.thumbnailUrl)) {
    const thumbRef = ref(storage, showreel.thumbnailUrl);
    deletionPromises.push(deleteObject(thumbRef));
  }

  if (deletionPromises.length === 0) return;

  // Execute deletions in parallel with best-effort settling
  const results = await Promise.allSettled(deletionPromises);
  
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ 
        err: result.reason, 
        msg: `Failed to delete storage object for showreel entry at index ${index}` 
      });
    }
  });
}