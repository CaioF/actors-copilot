"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for managing actor skills and accents as tag-based entries.
 * Supports adding and removing skills/accent tags.
 */
export function SkillsAccentsSection() {
  const { watch, setValue } = useFormContext<ActorProfile>();
  const skills = watch("skillsAndAccents");
  const [input, setInput] = useState("");

  /**
   * Adds a new skill or accent tag if it doesn't already exist in the list.
   */
  const addSkill = () => {
    const val = input.trim();
    if (val && !skills.includes(val)) {
      setValue("skillsAndAccents", [...skills, val], { shouldDirty: true });
      setInput("");
    }
  };

  /**
   * Removes a skill or accent tag at the specified index.
   * @param index - The index of the skill to remove
   */
  const removeSkill = (index: number) => {
    setValue("skillsAndAccents", skills.filter((_, i) => i !== index), { shouldDirty: true });
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Skills & Accents</h3>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 rounded-full bg-[#3D4A3C] px-3 py-1.5 text-xs font-medium text-white"
            >
              {skill}
              <button type="button" onClick={() => removeSkill(i)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
          placeholder="Add a skill and press Enter"
          className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
        <button
          type="button"
          onClick={addSkill}
          className="flex items-center gap-1.5 rounded-lg bg-[#3D4A3C] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4A5548]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
