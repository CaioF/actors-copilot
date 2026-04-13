"use client";

import { useFormContext } from "react-hook-form";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Form section for agent/representation details including agency name, contact info, and publicity toggle.
 */
export function AgentSection() {
  const { register, watch, setValue } = useFormContext<ActorProfile>();
  const showContactPublicly = watch("showContactPublicly");

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Agent / Representation</h3>

      {/* Agency Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">Agency Name</label>
        <input
          {...register("agencyName")}
          type="text"
          placeholder="Agency Name"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Contact Email */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">
          Contact Email (optional)
        </label>
        <input
          {...register("agencyEmail")}
          type="email"
          placeholder="agent@agency.com"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Agency Website */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">
          Agency Website (optional)
        </label>
        <input
          {...register("agencyWebsite")}
          type="url"
          placeholder="https://agency.com"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#2C3328]">
          Phone (optional)
        </label>
        <input
          {...register("agencyPhone")}
          type="tel"
          placeholder="+44 20 7123 4567"
          className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 px-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
        />
      </div>

      {/* Show Contact Details Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setValue("showContactPublicly", !showContactPublicly, { shouldDirty: true })}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            showContactPublicly ? "bg-[#E8721A]" : "bg-[#C7C0B5]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              showContactPublicly ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-[#2C3328]">Show contact details publicly</span>
      </div>
    </div>
  );
}
