"use client";

import { AuditionFormData } from "@/lib/audition-types";
import { CheckCircle2, FileText, AlignLeft, Calendar, User, Film } from "lucide-react";

interface StepReviewProps {
  data: AuditionFormData;
}

export function StepReview({ data }: StepReviewProps) {
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-[#B7BCB6] text-xs mb-1 flex items-center gap-1"><Film className="w-3 h-3"/> Project</p>
              <p className="font-medium text-lg">{data.project || <span className="text-[#B7BCB6]/50 italic">Not provided</span>}</p>
            </div>
            <div>
              <p className="text-[#B7BCB6] text-xs mb-1 flex items-center gap-1"><User className="w-3 h-3"/> Role</p>
              <p className="font-medium text-lg">{data.role || <span className="text-[#B7BCB6]/50 italic">Not provided</span>}</p>
            </div>
            <div>
              <p className="text-[#B7BCB6] text-xs mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Deadline</p>
              <p className="font-medium text-lg">{data.deadline || <span className="text-[#B7BCB6]/50 italic">No deadline</span>}</p>
            </div>
          </div>
        </div>

        {/* Block 2: Sides & Brief  */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sides */}
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

          {/* Brief */}
          <div className="bg-[#2C3328] shadow-lg rounded-2xl p-6 border border-[#B7BCB6]/40">
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

        </div>

      </div>
    </div>
  );
}