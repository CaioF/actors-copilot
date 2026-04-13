"use client";

import { PhotosSection } from "./sections/photos-section";
import { BasicInfoSection } from "./sections/basic-info-section";
import { PhysicalDetailsSection } from "./sections/physical-details-section";
import { AboutMeSection } from "./sections/about-me-section";
import { AgentSection } from "./sections/agent-section";
import { ShowreelsSection } from "./sections/showreels-section";
import { CreditsSection } from "./sections/credits-section";
import { TrainingSection } from "./sections/training-section";
import { ExternalProfilesSection } from "./sections/external-profiles-section";
import { SkillsAccentsSection } from "./sections/skills-accents-section";
import { CvUploadSection } from "./sections/cv-upload-section";
import { Save } from "lucide-react";
import type { SaveStatus } from "@/app/(interior)/profile/page";

interface ActorProfileFormProps {
  onSave: () => void;
  saveStatus: SaveStatus;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#C7C0B5]/50 bg-[#F5F0E8] p-6">
      {children}
    </div>
  );
}

export function ActorProfileForm({ onSave, saveStatus }: ActorProfileFormProps) {
  return (
    <div className="space-y-6">
      <SectionCard>
        <PhotosSection />
      </SectionCard>

      <SectionCard>
        <BasicInfoSection />
      </SectionCard>

      <SectionCard>
        <PhysicalDetailsSection />
      </SectionCard>

      <SectionCard>
        <AboutMeSection />
      </SectionCard>

      <SectionCard>
        <AgentSection />
      </SectionCard>

      <SectionCard>
        <ShowreelsSection />
      </SectionCard>

      <SectionCard>
        <CreditsSection />
      </SectionCard>

      <SectionCard>
        <TrainingSection />
      </SectionCard>

      <SectionCard>
        <ExternalProfilesSection />
      </SectionCard>

      <SectionCard>
        <SkillsAccentsSection />
      </SectionCard>

      <SectionCard>
        <CvUploadSection />
      </SectionCard>

      {/* Save Button */}
      <button
        type="button"
        onClick={onSave}
        disabled={saveStatus === "saving"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8721A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#E8721A]/90 disabled:opacity-70"
      >
        <Save className="h-4 w-4" />
        {saveStatus === "saving" ? "Saving..." : "Save & Preview Profile"}
      </button>
    </div>
  );
}
