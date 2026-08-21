"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActorProfile, CREDIT_CATEGORIES, CREDIT_CATEGORY_LABELS, CreditCategory } from "@/lib/profile-types";
import { cn } from "@/lib/utils";

/**
 * Form section for managing actor training organized by category (television, film, theatre, etc.).
 * Supports adding, removing, and filtering training entries by category type.
 */
export function TrainingSection() {
  const { register, control, watch } = useFormContext<ActorProfile>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "training",
  });
  const [activeTab, setActiveTab] = useState<CreditCategory>("television");
  const training = watch("training");

  const filteredIndexes = fields
    .map((field, index) => ({ field, index }))
    .filter(({ index }) => training[index]?.category === activeTab);

  const getCategoryCount = (cat: CreditCategory) =>
    training.filter((t) => t.category === cat).length;

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">Training</h3>

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

      {/* Training Rows */}
      <div className="space-y-3">
        {filteredIndexes.map(({ field, index }) => (
          <div key={field.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              {...register(`training.${index}.institution`)}
              type="text"
              placeholder="Institution"
              className="flex-1 min-w-[120px] rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`training.${index}.qualification`)}
              type="text"
              placeholder="Qualification/Course attended"
              className="flex-1 min-w-[140px] rounded-xl border border-border bg-input/50 py-2.5 px-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`training.${index}.years`)}
              type="text"
              placeholder="Year(s)"
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
            institution: "",
            qualification: "",
            years: "",
          })
        }
        className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        + Add Training
      </button>
    </div>
  );
}
