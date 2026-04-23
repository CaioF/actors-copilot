"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for capturing basic actor information including name, playing age range, location, and gender.
 */
export function BasicInfoSection() {
  const { register } = useFormContext<ActorProfile>();

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Basic Information</h3>

      {/* Full Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Full Name</label>
        <input
          {...register("fullName")}
          type="text"
          placeholder="Full Name"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Playing Age Range */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Playing Age Range</label>
        <div className="flex items-center gap-2">
          <input
            {...register("playingAgeMin", { valueAsNumber: true })}
            type="number"
            placeholder="Min"
            min={1}
            max={100}
            className="w-20 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
          <span className="text-sm text-[#2C3328]">-</span>
          <input
            {...register("playingAgeMax", { valueAsNumber: true })}
            type="number"
            placeholder="Max"
            min={1}
            max={100}
            className="w-20 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Location</label>
        <input
          {...register("location")}
          type="text"
          placeholder="e.g. London, UK"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Gender */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Gender</label>
        <input
          {...register("gender")}
          type="text"
          placeholder="Gender"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>
    </div>
  );
}
