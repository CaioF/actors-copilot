"use client";

import React from "react";
import { UserPlus, Circle } from "lucide-react";

interface DnaVisualizationProps {
  totalExtractions?: number;
  highlightedIndex?: number;
}

export function DnaVisualization({ totalExtractions = 247, highlightedIndex = 6 }: DnaVisualizationProps) {
  const segments = 12;

  return (
    <div className="relative flex items-center justify-center">
      <div className="hidden md:block">
        <div className="flex items-start gap-8">
          {/* Left scale */}
          <div className="flex flex-col items-end text-xs text-muted-foreground pr-4">
            <span>5'</span>
            <div className="flex-1" />
            <span>3'</span>
          </div>

          {/* DNA column */}
          <div className="relative">
            <div className="h-[420px] w-64 select-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 200 420" className="w-full h-full">
                  {/* simple stylized helix-like rungs */}
                  {Array.from({ length: segments }).map((_, i) => {
                    const y = 20 + (i * (380 / segments));
                    const isHighlighted = i === highlightedIndex;
                    return (
                      <g key={i}>
                        <rect x={30} y={y - 8} width={140} height={16} rx={8} fill={isHighlighted ? "var(--tw-gradient-stops, var(--bg-primary))" : "var(--card)"} fillOpacity={isHighlighted ? 1 : 0.06} />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* right nav dots */}
            <div className="absolute right-[-56px] top-8 flex h-[320px] w-10 flex-col items-center justify-center gap-3 rounded-full border border-border bg-card p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${i === 3 ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden w-full">
        <div className="h-56 w-full rounded-lg border border-border bg-card" />
      </div>
    </div>
  );
}

export default DnaVisualization;
