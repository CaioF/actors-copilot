"use client";

import { Drama, Film, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectType, SavedAuditionSummary } from "@/lib/auditions/audition-repository";

interface SceneStudyAuditionPickerProps {
  auditions: SavedAuditionSummary[];
  selectedId: string | null;
  onSelect: (auditionId: string) => void;
  onClear: () => void;
}

const projectTypeMeta: Record<ProjectType, { label: string; Icon: typeof Film }> = {
  cinematic: { label: "Cinematic", Icon: Film },
  theater: { label: "Theater", Icon: Drama },
  commercial: { label: "Commercial", Icon: ShoppingBag },
};

/**
 * Formats a saved auditions creation date the same way My Auditions does.
 */
function formatDate(date: Date | null): string {
  if (!date) return "Unknown Date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * SceneStudyAuditionPicker Component
 * Lists the member's saved auditions so a scene that was already broken down
 * can be picked up again without re-typing it. Presentational only — the
 * parent owns the data and the selection.
 * @returns The saved auditions picker
 */
export function SceneStudyAuditionPicker({
  auditions,
  selectedId,
  onSelect,
  onClear,
}: SceneStudyAuditionPickerProps) {
  return (
    <section
      aria-label="Saved auditions"
      className="rounded-3xl bg-card text-card-foreground border border-border shadow-sm p-6 sm:p-8 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold tracking-widest text-primary uppercase block mb-1">
            Saved Auditions
          </span>
          <h2 className="text-2xl font-title font-bold text-foreground">Continue a saved scene</h2>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Pick one of your saved auditions to load its scene and breakdown into Scene Study.
          </p>
        </div>

        {selectedId && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 border border-border text-muted-foreground hover:text-foreground hover:bg-muted px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            Start a new scene instead
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auditions.map((audition) => {
          const meta = projectTypeMeta[audition.projectType];
          const Icon = meta.Icon;
          const isSelected = audition.id === selectedId;
          const analysisLabel =
            audition.hasSides && audition.hasBrief
              ? "Sides + Brief"
              : audition.hasBrief
                ? "Brief breakdown"
                : "Sides breakdown";

          return (
            <button
              key={audition.id}
              type="button"
              onClick={() => onSelect(audition.id)}
              aria-pressed={isSelected}
              className={cn(
                "text-left rounded-2xl border p-5 transition-colors",
                isSelected
                  ? "border-primary ring-1 ring-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {meta.label}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-sm border border-border text-muted-foreground">
                  {analysisLabel}
                </span>
              </div>

              <h3 className="font-title text-base font-bold text-foreground uppercase truncate">
                {audition.project}
              </h3>
              <p className="text-xs text-muted-foreground uppercase truncate mt-0.5">{audition.role}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-3">
                {formatDate(audition.createdAt)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
