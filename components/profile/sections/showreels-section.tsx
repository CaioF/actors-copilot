"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";
import { VideoDropzone } from "./VideoDropzone";
import { deleteShowreelFile } from "@/lib/showreels/storage";
import { logger } from "@/lib/logger";

/**
 * Form section for managing actor showreels.
 * Orchestrates the relationship between the UI fields, client-side storage cleanup,
 * and the automated thumbnail extraction/upload process.
 */
export function ShowreelsSection() {
  const { register, control } = useFormContext<ActorProfile>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "showreels",
  });

  /**
   * Ingests successful upload payloads from VideoDropzone.
   * Synchronizes the newly created Storage assets with the React Hook Form state.
   */
  const handleUploadSuccess = (url: string, fileName: string, thumbnailUrl: string | null) => {
    append({ 
      title: fileName, 
      url: url, 
      thumbnailUrl: thumbnailUrl || "" 
    });
  };

  /**
   * Handles the removal of a showreel entry.
   * Triggers a fire-and-forget storage deletion to clean up binary assets (video + thumbnail)
   * before mutating the form state.
   */
  const handleRemove = (index: number) => {
    const field = fields[index];
    
    // Trigger infrastructure cleanup without blocking UI state mutation
    if (field.url) {
      deleteShowreelFile({ 
        url: field.url, 
        thumbnailUrl: field.thumbnailUrl 
      }).catch((err) => {
        logger.error({ err, msg: "Background storage cleanup failed during showreel removal" });
      });
    }

    remove(index);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-foreground font-title">Showreels</h3>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-3">
            {/* Hidden field to ensure thumbnailUrl is included in the auto-save payload */}
            <input 
              type="hidden" 
              {...register(`showreels.${index}.thumbnailUrl`)} 
            />
            
            <input
              {...register(`showreels.${index}.title`)}
              type="text"
              placeholder="Title"
              className="w-1/3 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <input
              {...register(`showreels.${index}.url`)}
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-xl border border-border bg-input/50 py-2.5 px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="flex-shrink-0 p-2 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => append({ title: "", url: "", thumbnailUrl: "" })}
        className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        + Add Showreel
      </button>

      <VideoDropzone onUploadSuccess={handleUploadSuccess} />
    </div>
  );
}