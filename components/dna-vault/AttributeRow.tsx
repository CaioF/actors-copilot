import React from "react";

interface AttributeRowProps {
  strength?: number; // 0..1
}

export function AttributeRow({ strength = 0.85 }: AttributeRowProps) {
  const pct = Math.round(strength * 100);

  return (
    <div className="flex items-center gap-2.5 w-28 shrink-0">
      <div className="h-2 flex-1 overflow-hidden rounded-full border border-border/50 bg-muted/60">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold text-primary/90 w-7 text-right tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export default AttributeRow;
