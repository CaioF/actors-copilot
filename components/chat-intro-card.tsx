"use client";

import { Sparkles } from "lucide-react";

interface ChatIntroCardProps {
  content?: string;
}

/**
 * Styled intro card component for the initial DNA extraction message.
 * Formats introductory prompt data into an editorial layout matching app design standards.
 * @param {ChatIntroCardProps} props - Component properties containing raw intro content
 * @returns {JSX.Element} The rendered intro hero card layout
 */
export function ChatIntroCard({ content }: ChatIntroCardProps) {
  return (
    <div className="w-full rounded-3xl bg-card/70 dark:bg-card/40 text-card-foreground border border-border/50 p-6 sm:p-7 shadow-2xs transition-all my-2 space-y-4">
      <div>
        <h2 className="font-title text-xl sm:text-2xl font-bold leading-tight text-foreground">
          Personal DNA Extraction
        </h2>
        <p className="font-title text-base sm:text-lg text-primary mt-0.5 italic">
          Building a truthful, specific archive of your authentic persona for powerful acting.
        </p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Every great actor draws from a private, lived archive—real moments where something was at stake. This engine conducts a thorough analysis of your underlying patterns so your AI Acting Coach can tailor audition notes directly to you.
      </p>

      {/* Clean guidance note */}
      <div className="rounded-2xl bg-muted/40 p-4 border border-border/40 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>How to move through this space:</span>
        </p>
        <p className="leading-relaxed">
          Take your time. Each chapter is designed for deep reflection. You don&apos;t need to complete everything in one sitting—work at your own pace, or use the <span className="font-semibold text-foreground">Upload Baseline</span> button in the top bar to submit a bio or journal entry anytime.
        </p>
      </div>

      {/* Initial Question */}
      <div className="pt-2 border-t border-border/50 space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
          Starting Point • Chapter 1: Foundation & Persona
        </p>
        <p className="text-sm font-medium text-foreground bg-muted/30 rounded-2xl p-4 border border-border/40 leading-relaxed">
          To begin establishing your baseline: How old are you, where are you from, and what is the &quot;elevator pitch&quot; you usually use to describe yourself to a stranger?
        </p>
      </div>
    </div>
  );
}