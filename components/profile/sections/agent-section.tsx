"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for agent/representation details including agency name, contact info, and publicity toggle.
 * Supports actors represented by multiple agencies via dynamic field array.
 */
export function AgentSection() {
  const { register, control, watch, setValue } = useFormContext<ActorProfile>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "agents",
  });
  const showContactPublicly = watch("showContactPublicly");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground font-title">
          Agent / Representation
        </h3>
        {fields.length > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            {fields.length} {fields.length === 1 ? "Agency" : "Agencies"}
          </span>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">No agent or agency added yet.</p>
          <button
            type="button"
            onClick={() =>
              append({ agencyName: "", agencyEmail: "", agencyWebsite: "", agencyPhone: "" })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Agent / Agency
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="relative space-y-4 rounded-xl border border-border bg-card/50 p-4 transition-all hover:border-border/80"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-title">
                  Agent #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors p-1"
                  title="Remove Agent"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remove</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Agency Name */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Agency Name
                  </label>
                  <input
                    {...register(`agents.${index}.agencyName`)}
                    type="text"
                    placeholder="e.g. Creative Artists Agency (CAA)"
                    className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Contact Email (optional)
                  </label>
                  <input
                    {...register(`agents.${index}.agencyEmail`)}
                    type="email"
                    placeholder="agent@agency.com"
                    className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Phone (optional)
                  </label>
                  <input
                    {...register(`agents.${index}.agencyPhone`)}
                    type="tel"
                    placeholder="+44 20 7123 4567"
                    className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
                  />
                </div>

                {/* Agency Website */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Agency Website (optional)
                  </label>
                  <input
                    {...register(`agents.${index}.agencyWebsite`)}
                    type="url"
                    placeholder="https://agency.com"
                    className="w-full rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              append({ agencyName: "", agencyEmail: "", agencyWebsite: "", agencyPhone: "" })
            }
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="h-4 w-4" />
            Add another agent
          </button>
        </div>
      )}

      {/* Show Contact Details Toggle */}
      <div className="pt-2 flex items-center gap-3">
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
        <span className="text-sm text-foreground font-medium">
          Show contact details publicly
        </span>
      </div>
    </div>
  );
}
