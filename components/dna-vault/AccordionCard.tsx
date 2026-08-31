"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionCard({ title, subtitle, icon, children, defaultOpen = false }: AccordionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:border-primary/40 break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-title font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>}
          </div>
        </div>

        <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
        </div>
      </button>

      {open && <div className="px-5 pb-5 pt-1 border-t border-border/40 space-y-2">{children}</div>}
    </div>
  );
}

export default AccordionCard;
