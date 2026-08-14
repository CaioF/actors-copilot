"use client"

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AccordionCard({ title, subtitle, children }: AccordionCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground transition-colors">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="font-title font-bold text-base truncate">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : "rotate-0"}`} />
      </button>

      <div className={`px-4 pb-4 ${open ? "block" : "hidden"}`}>{children}</div>
    </div>
  );
}

export default AccordionCard;
