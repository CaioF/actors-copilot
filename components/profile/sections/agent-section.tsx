"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for agent/representation details including agency name, contact info, and publicity toggle.
 */
export function AgentSection() {
  const { register, watch, setValue } = useFormContext<ActorProfile>();
  const showContactPublicly = watch("showContactPublicly");

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">Agent / Representation</h3>

      {/* Agency Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Agency Name</label>
        <input
          {...register("agencyName")}
          type="text"
          placeholder="Agency Name"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Contact Email */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Contact Email (optional)
        </label>
        <input
          {...register("agencyEmail")}
          type="email"
          placeholder="agent@agency.com"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Agency Website */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Agency Website (optional)
        </label>
        <input
          {...register("agencyWebsite")}
          type="url"
          placeholder="https://agency.com"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Phone (optional)
        </label>
        <input
          {...register("agencyPhone")}
          type="tel"
          placeholder="+44 20 7123 4567"
          className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
        />
      </div>

      {/* Show Contact Details Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setValue("showContactPublicly", !showContactPublicly, { shouldDirty: true })}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            showContactPublicly ? "bg-primary" : "bg-muted-foreground/40"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
              showContactPublicly ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-foreground font-medium">Show contact details publicly</span>
      </div>
    </div>
  );
}
