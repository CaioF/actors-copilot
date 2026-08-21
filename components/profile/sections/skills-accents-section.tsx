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
      <h3 className="text-base font-semibold text-foreground font-title">Skills & Accents</h3>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              {skill}
              <button type="button" onClick={() => removeSkill(i)} className="hover:text-primary/70">
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
          className="flex-1 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
        <button
          type="button"
          onClick={addSkill}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
