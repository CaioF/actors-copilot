"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ActorProfile, EXTERNAL_PROFILE_FIELDS, ExternalProfileKey } from "@/lib/profile-types";

/**
 * Form section for linking external social and professional profile URLs.
 */
export function ExternalProfilesSection() {
  const { register } = useFormContext<ActorProfile>();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground font-title">External Profiles</h3>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-primary transition-colors hover:text-primary/80"
          aria-label={isCollapsed ? "Expand external profiles" : "Collapse external profiles"}
        >
          {isCollapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {EXTERNAL_PROFILE_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {field.label} (optional)
              </label>
              <input
                {...register(`externalProfiles.${field.key as ExternalProfileKey}`)}
                type="text"
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
