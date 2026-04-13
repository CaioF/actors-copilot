"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { ActorProfile, WORK_PERMIT_OPTIONS } from "@/lib/profile-types";
import { cn } from "@/lib/utils";

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
   * Parses imperial height values (e.g., "5ft 9in", "5'9\"", "5ft") to centimeters.
   * @param value - The imperial height string to parse
   * @returns The height in centimeters, or null if parsing fails
   */
  const parseImperialToCm = (value: string): number | null => {
    const patterns = [
      /(\d+)\s*[\′']\s*(\d+)\s*[\″"]?$/,
      /(\d+)\s*ft\s*(\d+)\s*in$/i,
      /(\d+)\s*ft$/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) {
        const feet = parseInt(match[1], 10);
        const inches = match[2] ? parseInt(match[2], 10) : 0;
        return Math.round((feet * 12 + inches) * 2.54);
      }
    }
    return null;
  };

  /**
   * Parses a centimeter value string and converts it to imperial format (e.g., "175cm" to "5' 9").
   * @param value - The metric height string to parse
   * @returns The height in imperial format, or null if parsing fails
   */
  const parseCmToImperial = (value: string): string | null => {
    const cmMatch = value.match(/(\d+)\s*cm$/i);
    if (cmMatch) {
      const cm = parseInt(cmMatch[1], 10);
      const totalInches = cm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return inches === 12 ? `${feet + 1}' 0"` : `${feet}' ${inches}"`;
    }
    return null;
  };

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
      <h3 className="text-base font-semibold text-[#2C3328]">Physical & Professional Details</h3>

      {/* Height */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Height</label>
        <div className="flex items-center gap-2">
          <input
            {...register("height")}
            type="text"
            placeholder={heightUnit === "imperial" ? "5ft 9in" : "175cm"}
            className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
          <button
            type="button"
            onClick={convertHeight}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D4A3C] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4A5548]"
          >
            <Plus className="h-3.5 w-3.5" />
            {heightUnit === "imperial" ? "ft/in > cm" : "cm > ft/in"}
          </button>
        </div>
      </div>

      {/* Eye Colour */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Eye Colour</label>
        <input
          {...register("eyeColour")}
          type="text"
          placeholder="e.g. Blue"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Hair Colour */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Hair Colour</label>
        <input
          {...register("hairColour")}
          type="text"
          placeholder="e.g. Blonde/Medium"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Nationalities */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Nationalities</label>
        {nationalities.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {nationalities.map((nat, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-[#3D4A3C] px-3 py-1 text-xs font-medium text-white"
              >
                {nat}
                <button type="button" onClick={() => removeNationality(i)}>
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
            className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
          <button
            type="button"
            onClick={addNationality}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D4A3C] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4A5548]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Work Permits */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Work Permits</label>
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
                    ? "bg-[#E8721A] text-white"
                    : "border border-[#C7C0B5] bg-[#F0E9DE] text-[#2C3328]"
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
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">
          Ethnicity / Heritage (optional)
        </label>
        <input
          {...register("ethnicity")}
          type="text"
          placeholder="ex: Mixed Heritage"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Appearance */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Appearance</label>
        {appearance.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {appearance.map((app, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-[#3D4A3C] px-3 py-1 text-xs font-medium text-white"
              >
                {app}
                <button type="button" onClick={() => removeAppearance(i)}>
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
            className="flex-1 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
          <button
            type="button"
            onClick={addAppearance}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D4A3C] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4A5548]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
