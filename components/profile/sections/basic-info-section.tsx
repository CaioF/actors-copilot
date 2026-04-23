"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for capturing basic actor information including name, playing age range, location, and gender.
 */
export function BasicInfoSection() {
  const { register } = useFormContext<ActorProfile>();

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Basic Information</h3>

      {/* Full Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Full Name</label>
        <input
          {...register("fullName")}
          type="text"
          placeholder="Full Name"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Playing Age Range */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Playing Age Range</label>
        <div className="flex items-center gap-2">
          <input
            {...register("playingAgeMin", { valueAsNumber: true })}
            type="number"
            placeholder="Min"
            min={1}
            max={100}
            className="w-20 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
          <span className="text-sm text-[#2C3328]">-</span>
          <input
            {...register("playingAgeMax", { valueAsNumber: true })}
            type="number"
            placeholder="Max"
            min={1}
            max={100}
            className="w-20 rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Location</label>
        <input
          {...register("location")}
          type="text"
          placeholder="e.g. London, UK"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Timezone */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Base Timezone</label>
        <select
          {...register("timezone")}
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        >
          <option value="" disabled>Select your local timezone...</option>

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
          </optgroup>

          <optgroup label="Asia">
            <option value="Asia/Istanbul">Istanbul (TRT)</option>
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

      {/* Gender */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Gender</label>
        <input
          {...register("gender")}
          type="text"
          placeholder="Gender"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>
    </div>
  );
}
