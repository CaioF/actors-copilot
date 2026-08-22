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
      <h3 className="text-base font-semibold text-foreground font-title">Basic Information</h3>

      {/* Full Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
        <input
          {...register("fullName")}
          type="text"
          placeholder="Full Name"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Playing Age Range */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Playing Age Range</label>
        <div className="flex items-center gap-2">
          <input
            {...register("playingAgeMin", { valueAsNumber: true })}
            type="number"
            placeholder="Min"
            min={1}
            max={100}
            className="w-20 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
          />
          <span className="text-sm text-muted-foreground">-</span>
          <input
            {...register("playingAgeMax", { valueAsNumber: true })}
            type="number"
            placeholder="Max"
            min={1}
            max={100}
            className="w-20 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Location</label>
        <input
          {...register("location")}
          type="text"
          placeholder="e.g. London, UK"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Gender */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Gender</label>
        <input
          {...register("gender")}
          type="text"
          placeholder="Gender"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>
    </div>
  );
}
