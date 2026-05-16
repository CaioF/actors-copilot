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
 * Displays project basics, sides info, and character brief status.
 * @param data - Current audition form data to review
 */
export function StepReview({ data, mode }: StepReviewProps) {
  return (
    <div className="rounded-3xl bg-[#424842] shadow-2xl p-8 sm:p-12 text-[#EADDCE] w-full max-w-6xl mx-auto font-sans">
      
      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-title font-medium text-[#EADDCE] mb-2">Ready to Generate</h2>
        <p className="text-[#B7BCB6] text-sm">Review your audition details before we synthesize the breakdown.</p>
      </div>

      <div className="space-y-6">
        
        {/* Block 1: Basics */}
        <div className="bg-[#2C3328] shadow-lg rounded-2xl p-6 border border-[#B7BCB6]/40">
          <h3 className="text-[#FF7316] font-medium text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Basics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="flex items-center gap-3">
              <Film className="w-5 h-5 text-[#FF7316]" />
              <div className="flex flex-col">
                <span className="text-xs text-[#B7BCB6] uppercase tracking-wider">Project</span>
                {/* * SENIOR FIX: CSS-driven text transformation. 
                 * Protects against JS runtime errors on nullish values and enforces strict 
                 * separation of concerns between data state and UI presentation. 
                 */}
                <span className="font-medium text-lg uppercase">{data.project}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#FF7316]" />
              <div className="flex flex-col">
                <span className="text-xs text-[#B7BCB6] uppercase tracking-wider">Role</span>
                {/* SENIOR FIX: Consistent CSS-driven uppercase rendering */}
                <span className="font-medium text-lg uppercase">{data.role}</span>
              </div>
            </div>

            {data.deadline && (
              (() => {
                /**
                 * Resilient DateTime Splitting.
                 * Safely parses the raw deadline string (handling 'T' or space delimiters)
                 * to isolate the time component for UI spacing, strictly respecting the 
                 * existing AuditionFormData schema without requiring type changes.
                 */
                const parts = data.deadline.includes("T") ? data.deadline.split("T") : data.deadline.split(" ");
                const datePart = parts[0];
                const timePart = parts.length > 1 ? parts.slice(1).join(" ") : null;

                return (
                  <div className="flex items-center gap-3 md:col-span-2 lg:col-span-1">
                    <Calendar className="w-5 h-5 text-[#FF7316]" />
                    <div className="flex flex-col">
                      <span className="text-xs text-[#B7BCB6] uppercase tracking-wider">Deadline</span>
                      <span className="font-medium text-lg flex items-center gap-2 uppercase">
                        <span>{datePart}</span>
                        {timePart && (
                          <span className="text-[#B7BCB6]">at {timePart}</span>
                        )}
                      </span>
                      {/* NOVO: Exibe a timezone selecionada logo abaixo do horário */}
                      {data.auditionTimezone && (
                        <span className="text-[11px] text-[#B7BCB6]/70 uppercase tracking-widest mt-0.5">
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

        {/* Block 2: Sides & Brief  */}
        <div className=" justify-center gap-6">
          
          {/* Sides */}
          {mode === "sides" && (
            <div className="bg-[#2C3328] shadow-lg rounded-2xl p-6 border border-[#B7BCB6]/40">
              <h3 className="text-[#FF7316] font-medium text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Sides
              </h3>
              {data.sidesFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#B7BCB6]" />
                  <span className="font-medium truncate">{data.sidesFile.name}</span>
                </div>
              ) : data.sidesText ? (
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-[#B7BCB6]" />
                  <span className="font-medium text-sm truncate">Text pasted ({data.sidesText.split(' ').length} words)</span>
                </div>
              ) : (
                <span className="text-[#B7BCB6]/50 italic">No sides provided</span>
              )}
            </div>
          )}

          {/* Brief */}
          {/* 4. Condicional para mostrar apenas BRIEF */}
          {mode === "brief" && (
            <div className="bg-[#2C3328] shadow-lg rounded-2xl p-6 border border-[#B7BCB6]/40 ">
              <h3 className="text-[#FF7316] font-medium text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Character Brief
              </h3>
              {data.briefFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#B7BCB6]" />
                  <span className="font-medium truncate">{data.briefFile.name}</span>
                </div>
              ) : data.briefText ? (
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-[#B7BCB6]" />
                  <span className="font-medium text-sm truncate">Text pasted ({data.briefText.split(' ').length} words)</span>
                </div>
              ) : (
                <span className="text-[#B7BCB6]/50 italic">No brief provided</span>
              )}
            </div>
          )}
          </div>

        </div>

      </div>

  );
}