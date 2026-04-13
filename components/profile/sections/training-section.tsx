"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActorProfile, CREDIT_CATEGORIES, CREDIT_CATEGORY_LABELS, CreditCategory } from "@/lib/profile-types";
import { cn } from "@/lib/utils";

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
      <h3 className="text-base font-semibold text-[#2C3328]">Training</h3>

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

      {/* Training Rows */}
      <div className="space-y-3">
        {filteredIndexes.map(({ field, index }) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              {...register(`training.${index}.institution`)}
              type="text"
              placeholder="Institution"
              className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`training.${index}.qualification`)}
              type="text"
              placeholder="Qualification"
              className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-3 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`training.${index}.years`)}
              type="text"
              placeholder="Year(s)"
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
            institution: "",
            qualification: "",
            years: "",
          })
        }
        className="text-sm font-medium text-[#E8721A] transition-colors hover:text-[#E8721A]/80"
      >
        + Add Training
      </button>
    </div>
  );
}
