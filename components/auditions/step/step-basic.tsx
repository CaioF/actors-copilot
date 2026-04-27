"use client";

import { Calendar, ShoppingBag, Film, Check, Drama, User, Globe } from "lucide-react";
import { AuditionFormData } from "@/lib/audition-types";
import { cn } from "@/lib/utils"; // Using shadcn utility for cleaner class management

interface StepBasicsProps {
  data: AuditionFormData;
  updateData: (data: Partial<AuditionFormData>) => void;
  mode: "sides" | "brief";
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

/**
 * StepBasics Component
 * Renders the first step of the audition wizard for collecting basic project information.
 * Includes project type selection (cinematic/theater/commercial) and project/role/deadline inputs.
 * @param data - Current audition form data
 * @param updateData - Callback to update form data
 */
export function StepBasics({ data, updateData, mode }: StepBasicsProps) {
  return (
    <div className="rounded-3xl font-sans bg-[#424842] shadow-2xl p-8 sm:p-12 text-[#EADDCE] w-full max-w-6xl mx-auto">
      
      <div className="mb-12">
        <div className="inline-flex items-center px-3 py-1 mb-4 rounded-full bg-[#FF7316]/10 border border-[#FF7316]/30 text-[#FF7316] text-xs font-bold tracking-wide uppercase">
          {mode === "sides" ? "Sides Analysis" : "Casting Brief Checklist"}
        </div>
        <h2 className="text-2xl font-title font-medium text-[#EADDCE]">
          Tell us about the {mode === "sides" ? "audition!" : "project!"}
        </h2>
         <p className="text-[#a9a9a9] mt-2 text-sm">
            {mode === "sides" 
              ? "Analyze your script sides to map out your performance." 
              : "Analyze the casting brief to build your character foundation."}
          </p>
      </div>

      {/* --- NEW SECTION: Project Category Selection --- */}
      <div className="space-y-4">
        <label className="text-sm font-medium mt-2 mb-4 block text-[#6B6B6B]">What kind of audition is this?</label>
        {/* present the choice as large, visual cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:gap-6">
          {projectTypes.map((type) => {
            const Icon = type.icon;
            // Checks if this card is the currently selected one
            const isSelected = data.projectType === type.id;
            
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => updateData({ projectType: type.id as "cinematic" | "commercial" | "theater" })}
                className={cn(
                  "flex items-start gap-3 sm:gap-4 xl:gap-5 p-5 sm:p-6 xl:p-7 rounded-2xl border text-left transition-all duration-200",
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
                    <h3 className="font-title text-lg font-bold text-[#2C3328]">{type.title}</h3>
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

          {/* Input: Casting Director Name */}
        {mode === "brief" && (
          <div>
            <label htmlFor="castingDirectorName" className="block text-sm font-medium text-[#B7BCB6] mb-3">
              Casting Director Name (optional)
            </label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2C3328]/40" />
              <input
                id="castingDirectorName"
                type="text"
                placeholder="e.g., Jane Smith"
                value={data.castingDirectorName || ""}
                onChange={(e) => updateData({ castingDirectorName: e.target.value })}
                className="w-full bg-[#EADDCE] rounded-xl pl-14 pr-5 py-4 text-[#2C3328] placeholder:text-[#2C3328]/40 focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all"
              />
            </div>
          </div>
        )}
        
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
        {mode === "brief" &&
          <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-[#B7BCB6] mb-3">
            Deadline (Date & Time)
          </label>
          <div className="relative">
            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2C3328]/40" />
            <input
              id="deadline"
              type="datetime-local" // <-- Mudança aqui
              value={data.deadline || ""}
              onChange={(e) => updateData({ deadline: e.target.value })}
              className="w-full bg-[#EADDCE] rounded-xl pl-14 pr-5 py-4 text-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all"
            />
          </div>
        </div>
        }
        
        {mode === "brief" && (
          <div>
            <label htmlFor="auditionTimezone" className="block text-sm font-medium text-[#B7BCB6] mb-3">
              Audition Timezone
            </label>
            <div className="relative">
            <Globe className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2C3328]/40" />
            <select
              id="auditionTimezone"
              value={data.auditionTimezone || ""}
              onChange={(e) => updateData({ auditionTimezone: e.target.value })}
              className="w-full bg-[#EADDCE] rounded-xl pl-14 pr-5 py-4 text-[#2C3328] focus:outline-none focus:ring-2 focus:ring-[#FF7316] transition-all appearance-none"
            >
              <option value="" disabled>Select the project's timezone...</option>
  
              <optgroup label="North America">
                <option value="Pacific/Honolulu">Hawaii (HST)</option>
                <option value="America/Anchorage">Alaska (AKST/AKDT)</option>
                <option value="America/Los_Angeles">Pacific Time - Los Angeles (PST/PDT)</option>
                <option value="America/Denver">Mountain Time - Denver (MST/MDT)</option>
                <option value="America/Chicago">Central Time - Chicago (CST/CDT)</option>
                <option value="America/New_York">Eastern Time - New York (EST/EDT)</option>
                <option value="America/Halifax">Atlantic Time - Halifax (AST/ADT)</option>
                <option value="America/Mexico_City">Mexico City (CST/CDT)</option>
              </optgroup>

              <optgroup label="South America">
                <option value="America/Bogota">Bogota / Lima / Quito (COT/PET/ECT)</option>
                <option value="America/Caracas">Caracas (VET)</option>
                <option value="America/Santiago">Santiago (CLT/CLST)</option>
                <option value="America/Sao_Paulo">São Paulo / Buenos Aires (BRT/ART)</option>
              </optgroup>

              <optgroup label="Europe">
                <option value="Europe/London">London / Dublin (GMT/BST)</option>
                <option value="Europe/Lisbon">Lisbon (WET/WEST)</option>
                <option value="Europe/Paris">Paris / Central Europe (CET/CEST)</option>
                <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                <option value="Europe/Rome">Rome (CET/CEST)</option>
                <option value="Europe/Madrid">Madrid (CET/CEST)</option>
                <option value="Europe/Athens">Athens / Eastern Europe (EET/EEST)</option>
                <option value="Europe/Moscow">Moscow (MSK)</option>
                <option value="Europe/Istanbul">Istanbul (TRT)</option>
              </optgroup>

              <optgroup label="Asia">
                <option value="Asia/Jerusalem">Jerusalem (IST/IDT)</option>
                <option value="Asia/Riyadh">Riyadh (AST)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Karachi">Karachi (PKT)</option>
                <option value="Asia/Kolkata">India Standard Time - Mumbai/New Delhi (IST)</option>
                <option value="Asia/Bangkok">Bangkok / Jakarta (ICT/WIB)</option>
                <option value="Asia/Singapore">Singapore / Manila (SGT/PHT)</option>
                <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                <option value="Asia/Shanghai">Shanghai / Beijing (CST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Asia/Seoul">Seoul (KST)</option>
              </optgroup>

              <optgroup label="Oceania">
                <option value="Australia/Perth">Perth (AWST)</option>
                <option value="Australia/Adelaide">Adelaide (ACST/ACDT)</option>
                <option value="Australia/Sydney">Sydney / Melbourne (AEST/AEDT)</option>
                <option value="Australia/Brisbane">Brisbane (AEST)</option>
                <option value="Pacific/Auckland">Auckland / Wellington (NZST/NZDT)</option>
                <option value="Pacific/Fiji">Fiji (FJT)</option>
              </optgroup>

              <optgroup label="Africa">
                <option value="Africa/Casablanca">Casablanca (WEST)</option>
                <option value="Africa/Lagos">West Africa Time - Lagos (WAT)</option>
                <option value="Africa/Johannesburg">South Africa Standard Time - Johannesburg (SAST)</option>
                <option value="Africa/Cairo">Cairo (EET/EEST)</option>
                <option value="Africa/Nairobi">East Africa Time - Nairobi (EAT)</option>
              </optgroup>

              <optgroup label="Coordinated Universal Time">
                <option value="UTC">UTC (Coordinated Universal Time)</option>
              </optgroup>
            </select>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}