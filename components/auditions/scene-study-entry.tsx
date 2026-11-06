"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

import { AuditionWizard } from "@/components/auditions/audition-wizard";
import { SceneStudyAuditionPicker } from "@/components/auditions/scene-study-audition-picker";
import { listSavedAuditions, type SavedAuditionSummary } from "@/lib/auditions/audition-repository";
import { resolveUserPath } from "@/lib/auditions/user-path";
import { logger } from "@/lib/logger";

/**
 * SceneStudyEntry Component
 * The direct Scene Study landing.
 *
 * It resolves the signed-in member, reads their saved auditions from the same
 * Firestore collection My Auditions reads, and lets them pick one to continue
 * working on. With no saved auditions the manual scene flow below is
 * untouched, and nothing is ever created by simply opening Scene Study.
 * @returns The saved auditions picker plus the audition wizard
 */
export function SceneStudyEntry() {
  const [auditions, setAuditions] = useState<SavedAuditionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const userPath = resolveUserPath(user);

      // No signed-in member: keep the manual scene creation flow intact.
      if (!userPath) {
        setAuditions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      void (async () => {
        try {
          const saved = await listSavedAuditions(userPath);
          if (!cancelled) setAuditions(saved);
        } catch (error) {
          logger.error({ err: error, msg: "Failed to load saved auditions for Scene Study" });
          if (!cancelled) {
            setAuditions([]);
            setHasError(true);
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <div className="flex flex-col w-full">
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading your saved auditions...
        </div>
      )}

      {!isLoading && hasError && (
        <div
          role="alert"
          className="max-w-7xl mx-auto px-4 md:px-8 mb-6 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground"
        >
          We couldn&apos;t load your saved auditions right now. You can still start a new scene
          below — we&apos;ll pick your saved auditions up again the next time you open Scene
          Study.
        </div>
      )}

      {!isLoading && !hasError && auditions.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
          <SceneStudyAuditionPicker
            auditions={auditions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClear={() => setSelectedId(null)}
          />
        </div>
      )}

      {/* The key remounts the wizard when the selection changes, so picking a
          saved audition always starts from that audition's stored data and
          "Start a new scene instead" returns to a blank scene. */}
      <AuditionWizard
        key={selectedId ?? "new-scene"}
        mode="sides"
        auditionId={selectedId ?? undefined}
        loadSavedResult={selectedId !== null}
      />
    </div>
  );
}
