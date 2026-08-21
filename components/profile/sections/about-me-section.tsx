"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for capturing actor bio information including awards callout and biography text.
 */
export function AboutMeSection() {
  const { register, watch } = useFormContext<ActorProfile>();
  const bio = watch("bio");

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">About Me</h3>

      {/* Awards / Callout */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Awards / Callout (optional)
        </label>
        <input
          {...register("awardsCallout")}
          type="text"
          placeholder="e.g. Currently ranked #1 in the World Monologue Games"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Bio</label>
        <textarea
          {...register("bio")}
          rows={4}
          maxLength={500}
          placeholder="Tell casting directors about yourself..."
          className="w-full resize-none rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {bio?.length || 0}/500
        </p>
      </div>
    </div>
  );
}
