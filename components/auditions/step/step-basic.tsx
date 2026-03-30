"use client";

import { Calendar, ShoppingBag, Film, Check, Drama } from "lucide-react";
import { AuditionFormData } from "@/lib/audition-types";
import { cn } from "@/lib/utils"; // Using shadcn utility for cleaner class management

interface StepBasicsProps {
  data: AuditionFormData;
  updateData: (data: Partial<AuditionFormData>) => void;
}

// We define an array with the two project types
const projectTypes = [
  { 
    id: "cinematic", 
    title: "Cinematic (Film/TV)", 
    icon: Film, // Movie clapboard icon
    description: "Narrative, characters, dramatic arcs, specific emotional objectives." 
  },
  {
    id: "theater", 
    title: "Theater", 
    icon: Drama, // Theater mask icon
    description: "Live performance, stage presence, character development."
  },
  { 
    id: "commercial", 
    title: "Commercial (Ad/Promo)", 
    icon: ShoppingBag, // Shopping bag icon
    description: "Product focus, selling, branding, upbeat or clear delivery." 
  },
];

export function StepBasics({ data, updateData }: StepBasicsProps) {
  return (
    <div className="rounded-3xl font-sans bg-[#424842] shadow-2xl p-8 sm:p-12 text-[#EADDCE] w-full max-w-6xl mx-auto">
      
      {/* Título do Card */}
      <div className="mb-12">
        <h2 className="text-2xl font-serif font-medium text-[#EADDCE]">
          Tell us about the audition
        </h2>
      </div>

      {/* --- NEW SECTION: Project Category Selection --- */}
      <div className="space-y-4">
        <label className="text-sm font-medium mt-2 mb-4 block text-[#6B6B6B]">What kind of audition is this?</label>
        {/* present the choice as large, visual cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {projectTypes.map((type) => {
            const Icon = type.icon;
            // Checks if this card is the currently selected one
            const isSelected = data.projectType === type.id;
            
            return (
              <button
                key={type.id}
                onClick={() => updateData({ projectType: type.id as "cinematic" | "commercial" | "theater" })}
                className={cn(
                  "flex items-start gap-4 lg:gap-5 p-6 rounded-2xl border text-left transition-all duration-200",
                  "bg-[#f8ead2] border-[#C7C0B5] hover:border-[#E8721A] hover:ring-2 hover:ring-[#E8721A]/30",
                  isSelected && "border-[#E8721A] ring-2 ring-[#E8721A]/30 bg-amber-50"
                )}
              >
                {/* Visual marker of selection */}
                <div className={cn(
                  "mt-1 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border border-[#C7C0B5]",
                  isSelected && "bg-[#E8721A] border-[#E8721A]"
                )}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-6 h-6 text-[#6B6B6B]", isSelected && "text-[#E8721A]")} />
                    <h3 className="font-serif text-lg font-bold text-[#2C3328]">{type.title}</h3>
                  </div>
                  <p className="text-sm text-[#6B6B6B] mt-2 font-light">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {/* ----------------------------------------------- */}

      {/* Formulário */}
      <div className="pt-6 space-y-10">
        
        {/* Input: Project/Production */}
        <div>
          <label htmlFor="project" className="block text-sm font-medium text-[#B7BCB6] mb-3">
            Project/Production
          </label>
          <input
            id="project"
            type="text"
            placeholder="e.g., The Morning Show Season 5"
            value={data.project}
            onChange={(e) => updateData({ project: e.target.value })}
            className="w-full bg-[#EADDCE] rounded-xl px-5 py-4 text-[#2C3328] placeholder:text-[#2C3328]/40 focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all"
          />
        </div>

        {/* Input: Role/Character */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-[#B7BCB6] mb-3">
            Role/Character
          </label>
          <input
            id="role"
            type="text"
            placeholder="e.g., Dr. Sarah Chen"
            value={data.role}
            onChange={(e) => updateData({ role: e.target.value })}
            className="w-full bg-[#EADDCE] rounded-xl px-5 py-4 text-[#2C3328] placeholder:text-[#2C3328]/40 focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all"
          />
        </div>

        {/* Input: Deadline */}
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-[#B7BCB6] mb-3">
            Deadline (optional)
          </label>
          <div className="relative">
            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2C3328]/40" />
            <input
              id="deadline"
              type="date" // Usando texto para imitar a placeholder exata (dd/mm/aaaa)
              placeholder="dd/mm/aaaa"
              value={data.deadline || ""}
              onChange={(e) => updateData({ deadline: e.target.value })}
              className="w-full bg-[#EADDCE] rounded-xl pl-14 pr-5 py-4 text-[#2C3328] placeholder:text-[#2C3328]/40 focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all"
            />
          </div>
        </div>

      </div>
    </div>
  );
}