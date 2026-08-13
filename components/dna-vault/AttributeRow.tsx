import React from "react";

interface AttributeRowProps {
  name: string;
  strength?: number; // 0..1
  description?: string;
}

export function AttributeRow({ name, strength = 0, description }: AttributeRowProps) {
  const pct = Math.round(strength * 100);

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="font-medium text-sm text-card-foreground">{name}</div>
        {description && <div className="mt-1 text-xs text-muted-foreground truncate">{description}</div>}
      </div>

      <div className="w-32 flex-shrink-0">
        <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-muted">
          <div className="h-2 bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground text-right">{pct}%</div>
      </div>
    </div>
  );
}

export default AttributeRow;
