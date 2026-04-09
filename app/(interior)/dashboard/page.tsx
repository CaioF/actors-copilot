"use client";

import { useState } from "react";
import { Dna, Monitor, Sparkles, FileText } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { StepCard } from "@/components/step-card";
import { MemoryRecordingBanner } from "@/components/memory-recording-banner";
import { HistoryUploadModal } from "@/components/history-upload-modal";

export default function DashboardPage() {
  const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="My Self Tape Copilot" />

     
      {/* Step Cards*/}
      <div className="flex gap-6 px-8 pb-4">
        <StepCard
          stepNumber={1}
          title="Personal DNA Upload"
          description="Build the foundation of your craft. Through guided conversation, the Copilot learns your emotional anchors, lived experiences, strengths, and patterns — creating a Personal DNA Vault that makes your choices specific and truthful. This is not about oversharing. It's about identifying what's usable. The more you invest here, the sharper your auditions become."
          link="/chat"
          ctaLabel="Start building DNA"
          ctaIcon={Dna}
          variant="orange"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={2}
          title="Audition Sides Upload"
          description="Upload your sides and generate a clear, playable breakdown in minutes. The Copilot maps the role to your Personal DNA — producing grounded objectives, stakes, beats, turns, and tactics tailored to you. No guesswork. No spiraling. Just direction you can act on."
          link="/auditions/new"
          ctaLabel="Start New Audition"
          ctaIcon={Monitor}
          variant="orange"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={3}
          title="Casting Brief Upload"
          description="Upload the casting brief and the Copilot extracts every requirement: director/casting/producer context, tone references, and a clean checklist for framing, file size, naming, slate/ident, upload link, and deadline — so you don't miss details that cost you trust."
          link="/auditions/new"
          ctaLabel="Upload Character Brief"
          ctaIcon={Sparkles}
          variant="orange"
          bodyVariant="dark"
        />
      </div>

      {/* Memory Recording Banner */}
      <MemoryRecordingBanner />

       {/*Baseline Upload (Head Start) */}
      <div className="mx-8 mt-4 bg-[#3D4A3C] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl border border-[#B7BCB6]/10">
        <div className="flex gap-4 items-start">
          <div className="bg-[#FF7316]/20 p-3 rounded-2xl shrink-0 sm:mt-0">
            <FileText className="w-6 h-6 text-[#FF7316]" />
          </div>
          <div>
            <h3 className="text-[#EADDCE] text-xl font-medium font-title">
              Give The Coach a Head Start
            </h3>
            <p className="text-[#B7BCB6] text-sm max-w-4xl leading-relaxed">
              Already have a journal, therapy notes, or a written biography? Upload your baseline history so the AI can skip the small talk, analyze your core patterns instantly, and jump straight into deep extraction.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsBaselineModalOpen(true)}
          className="px-6 py-3 bg-[#FF7316] text-white rounded-full font-medium hover:bg-[#FF7316]/90 transition-all shrink-0 hover:scale-105 active:scale-95"
        >
          Upload Baseline
        </button>
      </div>


      {isBaselineModalOpen && (
        <HistoryUploadModal 
          onClose={() => setIsBaselineModalOpen(false)} 
          onSuccess={() => {
            setIsBaselineModalOpen(false);
            
          }} 
        />
      )}
    </main>
  );
}