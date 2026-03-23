"use client";

import { AuditionFormData } from "@/lib/audition-types";

interface StepBasicsProps {
  data: AuditionFormData;
  updateData: (data: Partial<AuditionFormData>) => void;
}

export function StepBasics({ data, updateData }: StepBasicsProps) {
  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto pt-4">
      
      {/* Cabeçalho do Passo */}
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-serif text-[#F5F0E8] mb-2">
          Let's start with the basics.
        </h2>
        <p className="text-[#F5F0E8]/60 text-sm">
          What are we preparing for?
        </p>
      </div>

      {/* Formulário */}
      <div className="space-y-6">
        
        {/* Input: Project */}
        <div>
          <label htmlFor="project" className="block text-sm font-medium text-[#F5F0E8]/80 mb-1.5">
            Project
          </label>
          <input
            id="project"
            type="text"
            placeholder="e.g. The Last Light"
            value={data.project}
            onChange={(e) => updateData({ project: e.target.value })}
            className="w-full bg-[#3D4A3C] border border-[#2A3325] rounded-xl px-4 py-3.5 text-[#F5F0E8] placeholder:text-[#F5F0E8]/30 focus:outline-none focus:ring-2 focus:ring-[#E8721A] focus:border-transparent transition-all"
          />
        </div>

        {/* Input: Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-[#F5F0E8]/80 mb-1.5">
            Role
          </label>
          <input
            id="role"
            type="text"
            placeholder="e.g. Sarah"
            value={data.role}
            onChange={(e) => updateData({ role: e.target.value })}
            className="w-full bg-[#3D4A3C] border border-[#2A3325] rounded-xl px-4 py-3.5 text-[#F5F0E8] placeholder:text-[#F5F0E8]/30 focus:outline-none focus:ring-2 focus:ring-[#E8721A] focus:border-transparent transition-all"
          />
        </div>

        {/* Input: Deadline */}
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-[#F5F0E8]/80 mb-1.5">
            Deadline <span className="text-[#F5F0E8]/40 font-normal">(Optional)</span>
          </label>
          <input
            id="deadline"
            type="date"
            value={data.deadline || ""}
            onChange={(e) => updateData({ deadline: e.target.value })}
            className="w-full bg-[#3D4A3C] border border-[#2A3325] rounded-xl px-4 py-3.5 text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#E8721A] focus:border-transparent transition-all [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>

      </div>
    </div>
  );
}