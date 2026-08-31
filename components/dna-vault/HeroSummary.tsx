"use client";

import React, { useState } from "react";
import { Sparkles, Brain, ChevronDown, ChevronUp, CheckCircle2, Dna, Clock } from "lucide-react";
import type { DnaAttribute } from "./DnaVaultGrid";
import { formatChatDuration } from "@/lib/dna/dna-parser";

interface HeroSummaryProps {
  completion: number; // 0..1
  totalAttributes: number;
  aiSummary?: string;
  attributes?: DnaAttribute[];
  totalChatSeconds?: number;
}

export function HeroSummary({
  completion,
  totalAttributes,
  aiSummary,
  attributes = [],
  totalChatSeconds = 0,
}: HeroSummaryProps) {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const percent = Math.round(completion * 100);

  // Extract 2–3 key highlight bullets from attributes or summary
  const keyHighlights = React.useMemo(() => {
    if (attributes.length > 0) {
      // Pick top traits with high strength or variety across categories
      const topTraits = attributes.slice(0, 3);
      return topTraits.map((t) => `${t.name} (${t.category.split("&")[0].trim()})`);
    }

    if (aiSummary) {
      const sentences = aiSummary
        .split(/[.•\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
      if (sentences.length > 0) {
        return sentences.slice(0, 3);
      }
    }

    return ["Extracted core psychological drivers", "Vocal & emotional reservoirs mapped"];
  }, [attributes, aiSummary]);

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-card-foreground shadow-md transition-all">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-title font-bold text-2xl text-foreground">Actor Profile Snapshot</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                <Dna className="h-3 w-3" />
                <span>{totalAttributes} Traits</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-3 w-3 text-primary" />
                <span>{formatChatDuration(totalChatSeconds)} in Session</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
              Extracted psychological reservoirs &amp; performance instincts
            </p>
          </div>
        </div>

        {/* Completion Progress Indicator */}
        <div className="flex items-center gap-4 bg-muted/40 border border-border/60 p-3 sm:px-4 rounded-2xl shrink-0">
          <div className="space-y-1 text-right">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vault Maturity</div>
            <div className="font-title text-xl font-bold text-primary">{percent}%</div>
          </div>
          <div className="w-24 sm:w-28 space-y-1">
            <div className="w-full overflow-hidden rounded-full border border-border/60 bg-muted h-2.5">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground text-right font-medium">
              {percent >= 80 ? "Rich Profile" : percent >= 40 ? "Building" : "Initial Session"}
            </div>
          </div>
        </div>
      </div>

      {/* Key Takeaway Highlights */}
      <div className="pt-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Dominant Extracted Signals</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {keyHighlights.map((highlight, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/30 border border-border/50 text-xs sm:text-sm font-medium text-foreground"
            >
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="line-clamp-2">{highlight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Full Psychological Synthesis */}
      {aiSummary && (
        <div className="mt-6 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={() => setIsSummaryExpanded((prev) => !prev)}
            className="flex items-center justify-between w-full py-2 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
          >
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span>{isSummaryExpanded ? "Hide Full Psychological Synthesis" : "Read Full Psychological Synthesis"}</span>
            </span>
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              {isSummaryExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>

          {isSummaryExpanded && (
            <div className="mt-3 p-4 sm:p-5 rounded-2xl border border-border/70 bg-muted/20 text-xs sm:text-sm text-foreground/90 leading-relaxed space-y-2 animate-in fade-in duration-300">
              <h4 className="font-title font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Executive Synthesis
              </h4>
              <p className="whitespace-pre-line">{aiSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HeroSummary;
