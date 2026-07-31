"use client";

import { AuditionFormData } from "@/lib/audition-types";
import { CheckCircle2, FileText, AlignLeft, Calendar, User, Film } from "lucide-react";

interface StepReviewProps {
  data: AuditionFormData;
  mode: "sides" | "brief";
}

/**
 * StepReview Component
 * Renders a review summary of all audition details before generation.
 * Displays project basics, sides info, and character brief status using semantic theme tokens.
 * @param data - Current audition form data to review
 * @param mode - Operating wizard mode ("sides" | "brief")
 */
export function StepReview({ data, mode }: StepReviewProps) {
  return (
    <div className="rounded-3xl bg-card text-card-foreground border border-border shadow-sm p-6 sm:p-10 w-full max-w-5xl mx-auto font-sans transition-colors">
      
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-title font-bold text-foreground mb-2">Ready to Generate</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">Review your audition details before we synthesize the breakdown.</p>
      </div>

      <div className="space-y-6">
        
        {/* Block 1: Basics Summary */}
        <div className="bg-muted/30 rounded-2xl p-6 border border-border shadow-xs">
          <h3 className="text-primary font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Basics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Project */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project</span>
                <span className="font-title font-bold text-lg uppercase text-foreground truncate">{data.project}</span>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <User className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</span>
                <span className="font-title font-bold text-lg uppercase text-foreground truncate">{data.role}</span>
              </div>
            </div>

            {/* Deadline */}
            {data.deadline && (
              (() => {
                const parts = data.deadline.includes("T") ? data.deadline.split("T") : data.deadline.split(" ");
                const datePart = parts[0];
                const timePart = parts.length > 1 ? parts.slice(1).join(" ") : null;

                return (
                  <div className="flex items-center gap-3 md:col-span-2 lg:col-span-1">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Deadline</span>
                      <span className="font-semibold text-base flex items-center gap-1.5 text-foreground uppercase">
                        <span>{datePart}</span>
                        {timePart && (
                          <span className="text-muted-foreground text-xs">at {timePart}</span>
                        )}
                      </span>
                      {data.auditionTimezone && (
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-0.5 truncate">
                          {data.auditionTimezone.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Block 2: Sides & Brief Details */}
        <div className="space-y-6">
          
          {/* Sides */}
          {mode === "sides" && (
            <div className="bg-muted/30 rounded-2xl p-6 border border-border shadow-xs">
              <h3 className="text-primary font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Sides
              </h3>
              {data.sidesFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground truncate">{data.sidesFile.name}</span>
                </div>
              ) : data.sidesText ? (
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">Text pasted ({data.sidesText.split(' ').length} words)</span>
                </div>
              ) : (
                <span className="text-muted-foreground/50 text-xs italic">No sides provided</span>
              )}
            </div>
          )}

          {/* Brief */}
          {mode === "brief" && (
            <div className="bg-muted/30 rounded-2xl p-6 border border-border shadow-xs">
              <h3 className="text-primary font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Character Brief
              </h3>
              {data.briefFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground truncate">{data.briefFile.name}</span>
                </div>
              ) : data.briefText ? (
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">Text pasted ({data.briefText.split(' ').length} words)</span>
                </div>
              ) : (
                <span className="text-muted-foreground/50 text-xs italic">No brief provided</span>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}