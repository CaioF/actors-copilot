"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";

export function ShowreelsSection() {
  const { register, control } = useFormContext<ActorProfile>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "showreels",
  });

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Showreels</h3>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-3">
            <input
              {...register(`showreels.${index}.title`)}
              type="text"
              placeholder="Title"
              className="w-1/3 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
            />
            <input
              {...register(`showreels.${index}.url`)}
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
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
        onClick={() => append({ title: "", url: "" })}
        className="text-sm font-medium text-[#E8721A] transition-colors hover:text-[#E8721A]/80"
      >
        + Add Showreel
      </button>
    </div>
  );
}
