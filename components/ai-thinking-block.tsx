"use client";

import { useState, useEffect } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiThinkingBlockProps {
  isReprocessing?: boolean;
  thoughtProcess?: string;
}

/**
 * Compact Claude-style thinking indicator block.
 * Auto-fits content width (w-fit) to avoid stretching across the screen.
 */
export function AiThinkingBlock({
  isReprocessing = false,
  thoughtProcess,
}: AiThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Copilot Avatar */}
      <div className="mt-auto mb-2">
        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full border border-border bg-card shadow-sm">
          <span className="text-[4px] font-medium uppercase tracking-wider text-muted-foreground">
            The
          </span>
          <span className="font-sans text-[7px] font-extrabold uppercase leading-none tracking-wide text-foreground">
            Actors
          </span>
          <span className="text-[4px] font-medium uppercase tracking-wider text-muted-foreground">
            Copilot
          </span>
        </div>
      </div>

      {/* Compact Thinking Card Container */}
      <div className="w-fit max-w-[85%]">
        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden transition-all">
          
          {/* Header Bar */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
          >
            <Brain className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              {isReprocessing
                ? "Reprocessing..."
                : `Thinking... (${elapsedSeconds}s)`}
            </span>

            {/* Pulsing Dots inside the pill */}
            <div className="flex gap-1 items-center ml-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </div>

            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground ml-1.5 transition-transform duration-200 shrink-0",
                isOpen && "rotate-180 text-foreground"
              )}
            />
          </button>

          {/* Expandable Reasoning Details */}
          {isOpen && (
            <div className="px-4 pb-3.5 pt-1.5 border-t border-border/50 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-150">
              {thoughtProcess ? (
                <p className="whitespace-pre-wrap">{thoughtProcess}</p>
              ) : (
                <div className="space-y-1 italic text-[11px]">
                  <p>• Analyzing character sides...</p>
                  <p>• Extracting Personal DNA reservoirs...</p>
                  <p>• Formulating response...</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}