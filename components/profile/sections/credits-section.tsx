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
      <h3 className="text-base font-semibold text-[#2C3328]">Credits</h3>

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
                  ? "bg-[#E8721A] text-white"
                  : "border border-[#C7C0B5] bg-[#F0E9DE] text-[#2C3328]"
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
          <div key={field.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register(`credits.${index}.featured`)}
              className="h-4 w-4 rounded border-[#C7C0B5] accent-[#E8721A]"
            />
            <input
              {...register(`credits.${index}.title`)}
              type="text"
              placeholder="Title"
              className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`credits.${index}.role`)}
              type="text"
              placeholder="Role"
              className="w-24 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`credits.${index}.year`)}
              type="text"
              placeholder="Year"
              className="w-20 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`credits.${index}.productionCompany`)}
              type="text"
              placeholder="Production"
              className="w-28 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="flex-shrink-0 p-2 text-[#6B6B6B] transition-colors hover:text-[#C45A3C]"
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
        className="text-sm font-medium text-[#E8721A] transition-colors hover:text-[#E8721A]/80"
      >
        + Add {CREDIT_CATEGORY_LABELS[activeTab]} Credit
      </button>
    </div>
  );
}
