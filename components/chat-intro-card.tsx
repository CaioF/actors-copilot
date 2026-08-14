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
    <div className="ml-5 mr-auto max-w-3xl rounded-3xl bg-card text-card-foreground border border-border p-8 shadow-sm transition-colors my-4">
      <h2 className="font-title text-2xl sm:text-3xl font-bold leading-tight text-foreground">
        This process exists for one reason only:
      </h2>
      <p className="font-title text-xl sm:text-2xl text-foreground/90 mt-1 mb-4">
        To make you a more truthful, bold, and compelling actor.
      </p>

      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Every great actor draws from a private, specific, lived archive. Not ideas. Not concepts. Events. Moments where something was at stake. Moments that left a mark.
        </p>
        <p>This engine helps you build that archive.</p>
      </div>

      <div className="mt-6 pt-2">
        <h3 className="font-title text-xl italic font-semibold text-primary mb-3">
          It will:
        </h3>
        <ul className="space-y-2 text-sm text-foreground/90">
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Extract real turning points from your life.</span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Anchor them in sensory truth so they are playable, not theoretical.</span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Map your patterns: needs, contradictions, protective strategies.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}