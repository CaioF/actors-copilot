import React from "react";
import { Sparkles } from "lucide-react";

interface HeroSummaryProps {
  completion: number; // 0..1
  totalAttributes: number;
  aiSummary?: string;
}

export function HeroSummary({ completion, totalAttributes, aiSummary }: HeroSummaryProps) {
  const percent = Math.round(completion * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-title font-bold text-2xl">Personal DNA Summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">{totalAttributes} traits extracted</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="text-sm font-medium text-primary-foreground">AI Insights</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">Completion</div>
        <div className="w-full overflow-hidden rounded-lg border border-border bg-muted">
          <div
            className="h-3 bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{percent}% complete</div>
      </div>

      {aiSummary && (
        <div className="mt-6 rounded-md border border-border bg-card p-4">
          <h3 className="font-title font-bold text-base">AI Insights Summary</h3>
          <p className="mt-2 text-sm text-muted-foreground">{aiSummary}</p>
        </div>
      )}
    </div>
  );
}

export default HeroSummary;
