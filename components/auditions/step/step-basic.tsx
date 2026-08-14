"use client";

import { Calendar, ShoppingBag, Film, Check, Drama, User, Globe, Clock, Clapperboard } from "lucide-react";
import { AuditionFormData } from "@/lib/audition-types";
import { cn } from "@/lib/utils"; 

interface StepBasicsProps {
  data: AuditionFormData;
  updateData: (data: Partial<AuditionFormData>) => void;
  mode: "sides" | "brief";
  isStandaloneScene?: boolean;
}

// Defines the available project categories to drive specialized prompting and assessment logic.
const projectTypes = [
  { 
    id: "cinematic", 
    title: "Cinematic (Film/TV)", 
    icon: Film, 
    description: "Narrative, characters, dramatic arcs, specific emotional objectives." 
  },
  {
    id: "theater", 
    title: "Theater", 
    icon: Drama, 
    description: "Live performance, stage presence, character development."
  },
  { 
    id: "commercial", 
    title: "Commercial (Ad/Promo)", 
    icon: ShoppingBag, 
    description: "Product focus, branding, upbeat or clear delivery." 
  },
];

/**
 * StepBasics Component
 * Renders the primary data collection interface for the audition pipeline.
 * Employs conditional rendering based on operational context while respecting global theme variables.
 */
export function StepBasics({ data, updateData, mode, isStandaloneScene }: StepBasicsProps) {
  const isSidesMode = mode === "sides";

  return (
    <div className="rounded-3xl bg-card text-card-foreground border border-border shadow-sm p-6 sm:p-10 w-full max-w-5xl mx-auto transition-colors">
      
      {/* Header Section */}
      <div className="mb-8">
        <span className="text-xs font-bold tracking-widest text-primary uppercase block mb-1">
          {isStandaloneScene ? "SCENE STUDY" : isSidesMode ? "SIDES ANALYSIS" : "CASTING BRIEF CHECKLIST"}
        </span>
        <h2 className="text-2xl sm:text-3xl font-title font-bold text-foreground">
          Tell us about the {isStandaloneScene ? "scene" : isSidesMode ? "audition" : "project"}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          This helps us create a more accurate and tailored breakdown.
        </p>
      </div>

      {/* Project Category Selection Grid */}
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projectTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = data.projectType === type.id;
            
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => updateData({ projectType: type.id as "cinematic" | "commercial" | "theater" })}
                className={cn(
                  "flex items-start gap-3 p-5 rounded-2xl border text-left transition-all duration-200",
                  isSelected
                    ? "border-primary ring-1 ring-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                {/* Radio Circle Indicator */}
                <div className={cn(
                  "mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded-full border border-border transition-colors",
                  isSelected && "border-primary bg-primary"
                )}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </div>

                {/* Card Content Matrix */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-5 h-5 text-muted-foreground", isSelected && "text-primary")} />
                    <h3 className="font-title text-base font-bold text-foreground">{type.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-normal">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Form Fields Container */}
      <div className="space-y-4">

        {/* Casting Director Input */}
        {!isSidesMode && (
          <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            <div className="flex items-center gap-2.5 w-48 shrink-0 text-foreground font-semibold text-xs sm:text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Casting Director</span>
              <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
            </div>
            <div className="h-5 w-[1px] bg-border mx-3 shrink-0" />
            <input
              id="castingDirectorName"
              type="text"
              placeholder="e.g., Jane Smith"
              value={data.castingDirectorName || ""}
              onChange={(e) => updateData({ castingDirectorName: e.target.value })}
              className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
        )}
        
        {/* Project Name Input */}
        <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
          <div className="flex items-center gap-2.5 w-48 shrink-0 text-foreground font-semibold text-xs sm:text-sm">
            <Clapperboard className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{isStandaloneScene ? "Source Material" : "Project / Production"}</span>
          </div>
          <div className="h-5 w-[1px] bg-border mx-3 shrink-0" />
          <input
            id="project"
            type="text"
            placeholder="e.g., The Morning Show Season 5"
            value={data.project}
            onChange={(e) => updateData({ project: e.target.value })}
            className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>

        {/* Role Designation Input */}
        <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
          <div className="flex items-center gap-2.5 w-48 shrink-0 text-foreground font-semibold text-xs sm:text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Role / Character</span>
          </div>
          <div className="h-5 w-[1px] bg-border mx-3 shrink-0" />
          <input
            id="role"
            type="text"
            placeholder="e.g., Dr. Sarah Chen"
            value={data.role}
            onChange={(e) => updateData({ role: e.target.value })}
            className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
        </div>

        {/* Deadline & Timezone Block */}
        {!isSidesMode && (
          <>
            {/* Deadline Input */}
            <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <div className="flex items-center gap-2.5 w-48 shrink-0 text-foreground font-semibold text-xs sm:text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                </div>
                <span>Deadline (Date & Time)</span>
              </div>
              <div className="h-5 w-[1px] bg-border mx-3 shrink-0" />
              <input
                id="deadline"
                type={data.deadline ? "datetime-local" : "text"}
                placeholder="Select date and time  ·  31/05/2026 23:59"
                onFocus={(e) => (e.target.type = "datetime-local")}
                onBlur={(e) => {
                  if (!data.deadline) e.target.type = "text";
                }}
                value={data.deadline || ""}
                onChange={(e) => updateData({ deadline: e.target.value })}
                className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
            </div>

            {/* Audition Timezone Dropdown */}
            <div className="flex items-center rounded-2xl border border-border bg-card px-4 py-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <div className="flex items-center gap-2.5 w-48 shrink-0 text-foreground font-semibold text-xs sm:text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Audition Timezone</span>
              </div>
              <div className="h-5 w-[1px] bg-border mx-3 shrink-0" />
              <select
                id="auditionTimezone"
                value={data.auditionTimezone || ""}
                onChange={(e) => updateData({ auditionTimezone: e.target.value })}
                className="w-full bg-transparent text-xs sm:text-sm text-foreground focus:outline-none cursor-pointer appearance-none"
              >
                <option value="" disabled className="bg-card text-foreground">Select the project's timezone...</option>
    
                <optgroup label="North America" className="bg-card text-foreground font-semibold">
                  <option value="Pacific/Honolulu">Hawaii (HST)</option>
                  <option value="America/Anchorage">Alaska (AKST/AKDT)</option>
                  <option value="America/Los_Angeles">Pacific Time - Los Angeles (PST/PDT)</option>
                  <option value="America/Denver">Mountain Time - Denver (MST/MDT)</option>
                  <option value="America/Chicago">Central Time - Chicago (CST/CDT)</option>
                  <option value="America/New_York">Eastern Time - New York (EST/EDT)</option>
                  <option value="America/Halifax">Atlantic Time - Halifax (AST/ADT)</option>
                  <option value="America/Mexico_City">Mexico City (CST/CDT)</option>
                </optgroup>

                <optgroup label="South America" className="bg-card text-foreground font-semibold">
                  <option value="America/Bogota">Bogota / Lima / Quito (COT/PET/ECT)</option>
                  <option value="America/Caracas">Caracas (VET)</option>
                  <option value="America/Santiago">Santiago (CLT/CLST)</option>
                  <option value="America/Sao_Paulo">São Paulo / Buenos Aires (BRT/ART)</option>
                </optgroup>

                <optgroup label="Europe" className="bg-card text-foreground font-semibold">
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

                <optgroup label="Asia" className="bg-card text-foreground font-semibold">
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

                <optgroup label="Oceania" className="bg-card text-foreground font-semibold">
                  <option value="Australia/Perth">Perth (AWST)</option>
                  <option value="Australia/Adelaide">Adelaide (ACST/ACDT)</option>
                  <option value="Australia/Sydney">Sydney / Melbourne (AEST/AEDT)</option>
                  <option value="Australia/Brisbane">Brisbane (AEST)</option>
                  <option value="Pacific/Auckland">Auckland / Wellington (NZST/NZDT)</option>
                  <option value="Pacific/Fiji">Fiji (FJT)</option>
                </optgroup>

                <optgroup label="Africa" className="bg-card text-foreground font-semibold">
                  <option value="Africa/Casablanca">Casablanca (WEST)</option>
                  <option value="Africa/Lagos">West Africa Time - Lagos (WAT)</option>
                  <option value="Africa/Johannesburg">South Africa Standard Time - Johannesburg (SAST)</option>
                  <option value="Africa/Cairo">Cairo (EET/EEST)</option>
                  <option value="Africa/Nairobi">East Africa Time - Nairobi (EAT)</option>
                </optgroup>

                <optgroup label="Coordinated Universal Time" className="bg-card text-foreground font-semibold">
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                </optgroup>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}