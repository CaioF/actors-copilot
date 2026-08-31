"use client";

import React, { useState } from "react";
import { Check, ChevronRight, Compass, Sparkles, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlightPlanStage } from "@/lib/acting-coach/contracts";

export interface StageDefinition {
  number: FlightPlanStage;
  title: string;
  shortLabel: string;
  description: string;
}

export const STAGES: StageDefinition[] = [
  { number: 1, title: "Stage 1. Orientate", shortLabel: "1. Orientate", description: "Brief requirements & given circumstances" },
  { number: 2, title: "Stage 2. The relationship", shortLabel: "2. Relationship", description: "Deep dive into the other character" },
  { number: 3, title: "Stage 3. Want, stakes and obstacle", shortLabel: "3. Want & Stakes", description: "Playable objective & why today" },
  { number: 4, title: "Stage 4. Actions and beats", shortLabel: "4. Actions & Beats", description: "Playable verbs & tactic shifts" },
  { number: 5, title: "Stage 5. Subtext and contradiction", shortLabel: "5. Subtext", description: "Thought behind eyes & hidden core" },
  { number: 6, title: "Stage 6. Your life is your instrument", shortLabel: "6. Personal DNA", description: "Actor's natural qualities & lived experience" },
  { number: 7, title: "Stage 7. Strong choices", shortLabel: "7. Strong Choices", description: "1-2 committed playable choices" },
  { number: 8, title: "Stage 8. Translate to camera", shortLabel: "8. To Camera", description: "Eyeline, listening, framing & self-tape" },
  { number: 9, title: "Stage 9. Ground and run the scene", shortLabel: "9. Ground & Run", description: "Pre-scene grounding & interactive runner" },
  { number: 10, title: "Stage 10. Cleared for takeoff", shortLabel: "10. Takeoff", description: "Mobile audition plan & final sign-off" },
];

interface FlightPlanProps {
  currentStage: FlightPlanStage;
  completedStages: number[];
  flightPlanMode: "guided" | "menu";
  onSelectStage: (stage: FlightPlanStage) => void;
  onOpenRunner?: () => void;
}

export function FlightPlan({
  currentStage,
  completedStages = [],
  flightPlanMode,
  onSelectStage,
  onOpenRunner,
}: FlightPlanProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeStageDef = STAGES.find((s) => s.number === currentStage) || STAGES[0];

  return (
    <div className="w-full bg-card/90 border-b border-border text-card-foreground px-4 sm:px-8 py-3 transition-colors shadow-sm">
      <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-3">
        {/* Active stage info badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-sm">
            {currentStage}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Flight Plan • {activeStageDef.shortLabel}
              </span>
              {flightPlanMode === "guided" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Guided Flow
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Navigation className="h-3 w-3 text-primary" />
                  Direct Stage
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              {activeStageDef.description}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {currentStage === 9 && onOpenRunner && (
            <button
              onClick={onOpenRunner}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-bold transition-colors shadow-sm"
            >
              Run Scene Now
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted hover:bg-muted/80 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <Compass className="h-3.5 w-3.5 text-primary" />
            Flight Plan Menu
          </button>
        </div>
      </div>

      {/* Stage Menu Dropdown / Drawer */}
      {isMenuOpen && (
        <div className="mx-auto max-w-5xl mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 animate-in fade-in duration-200">
          {STAGES.map((s) => {
            const isCurrent = s.number === currentStage;
            const isCompleted = completedStages.includes(s.number);

            return (
              <button
                key={s.number}
                onClick={() => {
                  onSelectStage(s.number);
                  setIsMenuOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all border",
                  isCurrent
                    ? "bg-primary/15 border-primary text-foreground"
                    : isCompleted
                    ? "bg-emerald-950/20 dark:bg-emerald-950/40 border-emerald-600/40 text-foreground hover:bg-emerald-900/30"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : s.number}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{s.shortLabel}</p>
                  <p className="text-[10px] opacity-75 line-clamp-1">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
