"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActorProfile, CREDIT_CATEGORIES, CREDIT_CATEGORY_LABELS, CreditCategory } from "@/lib/profile-types";
import { cn } from "@/lib/utils";

/**
 * Form section for managing actor credits organized by category (television, film, theatre, etc.).
 * Supports adding, removing, and filtering credits by category type.
 */
export function CreditsSection() {
  const { register, control, watch } = useFormContext<ActorProfile>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "credits",
  });
  const [activeTab, setActiveTab] = useState<CreditCategory>("television");
  const credits = watch("credits");

  const filteredIndexes = fields
    .map((field, index) => ({ field, index }))
    .filter(({ index }) => credits[index]?.category === activeTab);

  const getCategoryCount = (cat: CreditCategory) =>
    credits.filter((c) => c.category === cat).length;

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">Credits</h3>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CREDIT_CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat);
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "border border-border bg-muted/60 text-foreground hover:bg-muted"
              )}
            >
              {CREDIT_CATEGORY_LABELS[cat]}
              {count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Credit Rows */}
      <div className="space-y-3">
        {filteredIndexes.map(({ field, index }) => (
          <div key={field.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="checkbox"
              {...register(`credits.${index}.featured`)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <input
              {...register(`credits.${index}.title`)}
              type="text"
              placeholder="Title"
              className="flex-1 min-w-[120px] rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`credits.${index}.role`)}
              type="text"
              placeholder="Role"
              className="w-24 rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`credits.${index}.year`)}
              type="text"
              placeholder="Year"
              className="w-20 rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`credits.${index}.productionCompany`)}
              type="text"
              placeholder="Production"
              className="w-28 rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="flex-shrink-0 p-2 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          append({
            category: activeTab,
            title: "",
            role: "",
            year: "",
            productionCompany: "",
            featured: false,
          })
        }
        className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        + Add {CREDIT_CATEGORY_LABELS[activeTab]} Credit
      </button>
    </div>
  );
}
