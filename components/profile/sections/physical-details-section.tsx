"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { ActorProfile, WORK_PERMIT_OPTIONS } from "@/lib/profile-types";
import { cn } from "@/lib/utils";
import { parseImperialToCm, parseCmToImperial } from "@/lib/height-utils";

/**
 * Form section for capturing actor physical details including height, eye/hair color,
 * nationalities, work permits, ethnicity, and appearance attributes.
 */
export function PhysicalDetailsSection() {
  const { register, watch, setValue, getValues } = useFormContext<ActorProfile>();
  const heightUnit = watch("heightUnit");
  const nationalities = watch("nationalities");
  const workPermits = watch("workPermits");
  const appearance = watch("appearance");

  const [nationalityInput, setNationalityInput] = useState("");
  const [appearanceInput, setAppearanceInput] = useState("");

  /**
   * Toggles the height unit between imperial and metric, converting the existing value if present.
   */
  const convertHeight = () => {
    const currentHeight = getValues("height");
    if (!currentHeight) {
      setValue("heightUnit", heightUnit === "imperial" ? "metric" : "imperial", { shouldDirty: true });
      return;
    }

    if (heightUnit === "imperial") {
      const cm = parseImperialToCm(currentHeight);
      if (cm !== null) {
        setValue("height", `${cm}cm`, { shouldDirty: true });
      }
      setValue("heightUnit", "metric", { shouldDirty: true });
    } else {
      const imperial = parseCmToImperial(currentHeight);
      if (imperial !== null) {
        setValue("height", imperial, { shouldDirty: true });
      }
      setValue("heightUnit", "imperial", { shouldDirty: true });
    }
  };

  /**
   * Adds a new nationality to the profile if it's not already in the list.
   */
  const addNationality = () => {
    const val = nationalityInput.trim();
    if (val && !nationalities.includes(val)) {
      setValue("nationalities", [...nationalities, val], { shouldDirty: true });
      setNationalityInput("");
    }
  };

  /**
   * Removes a nationality from the profile at the specified index.
   * @param index - The index of the nationality to remove
   */
  const removeNationality = (index: number) => {
    setValue("nationalities", nationalities.filter((_, i) => i !== index), { shouldDirty: true });
  };

  /**
   * Toggles a work permit selection - adds if not present, removes if present.
   * @param permit - The work permit to toggle
   */
  const toggleWorkPermit = (permit: string) => {
    if (workPermits.includes(permit)) {
      setValue("workPermits", workPermits.filter((p) => p !== permit), { shouldDirty: true });
    } else {
      setValue("workPermits", [...workPermits, permit], { shouldDirty: true });
    }
  };

  /**
   * Adds a new appearance/heritage attribute to the profile if not already present.
   */
  const addAppearance = () => {
    const val = appearanceInput.trim();
    if (val && !appearance.includes(val)) {
      setValue("appearance", [...appearance, val], { shouldDirty: true });
      setAppearanceInput("");
    }
  };

  /**
   * Removes an appearance attribute from the profile at the specified index.
   * @param index - The index of the appearance to remove
   */
  const removeAppearance = (index: number) => {
    setValue("appearance", appearance.filter((_, i) => i !== index), { shouldDirty: true });
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">Physical & Professional Details</h3>

      {/* Height */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Height</label>
        <div className="flex items-center gap-2">
          <input
            {...register("height")}
            type="text"
            placeholder={heightUnit === "imperial" ? "5ft 9in" : "175cm"}
            className="flex-1 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
          />
          <button
            type="button"
            onClick={convertHeight}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            {heightUnit === "imperial" ? "ft/in > cm" : "cm > ft/in"}
          </button>
        </div>
      </div>

      {/* Eye Colour */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Eye Colour</label>
        <input
          {...register("eyeColour")}
          type="text"
          placeholder="e.g. Blue"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Hair Colour */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Hair Colour</label>
        <input
          {...register("hairColour")}
          type="text"
          placeholder="e.g. Blonde/Medium"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Nationalities */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Nationalities</label>
        {nationalities.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {nationalities.map((nat, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
              >
                {nat}
                <button type="button" onClick={() => removeNationality(i)} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nationalityInput}
            onChange={(e) => setNationalityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNationality())}
            placeholder="Add Nationality"
            className="flex-1 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
          />
          <button
            type="button"
            onClick={addNationality}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Work Permits */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Work Permits</label>
        <div className="flex flex-wrap gap-2">
          {WORK_PERMIT_OPTIONS.map((permit) => {
            const isSelected = workPermits.includes(permit);
            return (
              <button
                key={permit}
                type="button"
                onClick={() => toggleWorkPermit(permit)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "border border-border bg-muted/60 text-foreground hover:bg-muted"
                )}
              >
                {permit}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ethnicity / Heritage */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Ethnicity / Heritage (optional)
        </label>
        <input
          {...register("ethnicity")}
          type="text"
          placeholder="ex: Mixed Heritage"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Appearance */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Appearance</label>
        {appearance.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {appearance.map((app, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
              >
                {app}
                <button type="button" onClick={() => removeAppearance(i)} className="hover:text-primary/70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={appearanceInput}
            onChange={(e) => setAppearanceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAppearance())}
            placeholder="ex: White Scandinavian"
            className="flex-1 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
          />
          <button
            type="button"
            onClick={addAppearance}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
