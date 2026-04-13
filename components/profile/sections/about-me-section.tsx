"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

export function AboutMeSection() {
  const { register, watch } = useFormContext<ActorProfile>();
  const bio = watch("bio");

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">About Me</h3>

      {/* Awards / Callout */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">
          Awards / Callout (optional)
        </label>
        <input
          {...register("awardsCallout")}
          type="text"
          placeholder="e.g. Currently ranked #1 in the World Monologue Games"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Bio</label>
        <textarea
          {...register("bio")}
          rows={4}
          maxLength={500}
          placeholder="Tell casting directors about yourself..."
          className="w-full resize-none rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
        <p className="mt-1 text-right text-xs text-[#6B6B6B]">
          {bio?.length || 0}/500
        </p>
      </div>
    </div>
  );
}
