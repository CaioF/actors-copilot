"use client";

import { useState, useEffect, useRef } from "react";
import { Dna, Monitor, Sparkles, FileText } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { StepCard } from "@/components/step-card";
import { MemoryRecordingBanner } from "@/components/memory-recording-banner";
import { HistoryUploadModal } from "@/components/history-upload-modal";
import { IntroVideoModal } from "@/components/intro-video-modal";
import { useAuth } from "@/lib/context/AuthContext";
import { getHasSeenIntroVideo, markHasSeenIntroVideo } from "@/lib/firestore.utils";

/**
 * Main dashboard page showing the self-tape copilot workflow.
 * Displays step cards for Personal DNA, Audition Sides, and Casting Brief uploads.
 * @returns The rendered dashboard page
 */
export default function DashboardPage() {
  const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);
  const [isIntroVideoOpen, setIsIntroVideoOpen] = useState(false);
  const { user, loading } = useAuth();
  const checkedIntroUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user || checkedIntroUserIdRef.current === user.uid) return;

    let cancelled = false;

    const checkAndShowIntroVideo = async () => {
      try {
        const hasSeen = await getHasSeenIntroVideo(user.uid);
        checkedIntroUserIdRef.current = user.uid;
        if (!hasSeen && !cancelled) {
          setIsIntroVideoOpen(true);
          await markHasSeenIntroVideo(user.uid).catch(() => undefined);
        }
      } catch {
        checkedIntroUserIdRef.current = null;
      }
    };

    checkAndShowIntroVideo();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="My Self Tape Copilot" />

      {/* Step Cards*/}
      <div className="flex flex-col lg:flex-row gap-6 px-4 sm:px-8 pb-4">
        <StepCard
          stepNumber={1}
          title="Personal DNA Upload"
          description={"Build the foundation of your craft. Through guided conversation across 12 distinct sections, the Copilot learns your emotional anchors, lived experiences, strengths, and patterns—creating a Personal DNA Vault that makes your choices specific and truthful. This is not about oversharing; it's about identifying what's usable. Speak freely and share as much detail as possible in every session. The deeper the system understands you across these 12 areas, the sharper and more highly personalized your future audition analyses will become."}
          link="/chat"
          ctaLabel="Start building your DNA with the identity section"
          ctaIcon={Dna}
          variant="orange"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={2}
          title="Audition Breakdown"
          description={"Got a new audition? Always start here. Upload the casting brief to extract critical requirements like deadlines, slate instructions, and tone. Once analyzed, you can easily attach your sides to generate a character breakdown that perfectly aligns with the director's vision."}
          link="/auditions/new/brief"
          ctaLabel="Upload Casting Brief"
          ctaIcon={Sparkles}
          variant="orange"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={3}
          title="Working on a scene?"
          description="Training a monologue or class scene without a casting brief? Upload your script here to bypass audition logistics. We'll jump straight into generating a playable character breakdown mapped to your Actor DNA—giving you clear objectives, beats, and tactics."
          link="/auditions/new/sides"
          ctaLabel="Start Scene Study"
          ctaIcon={Monitor}
          variant="orange"
          bodyVariant="dark"
        />
      </div>

      {/* Memory Recording Banner */}
      <MemoryRecordingBanner />

       {/*Baseline Upload (Head Start) */}
      <div className="mx-4 sm:mx-8 mt-4 bg-[#3D4A3C] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl border border-[#B7BCB6]/10">
        <div className="flex gap-4 items-start">
          <div className="bg-[#FF7316]/20 p-3 rounded-2xl shrink-0 sm:mt-0">
            <FileText className="w-6 h-6 text-[#FF7316]" />
          </div>
          <div>
            <h3 className="text-[#EADDCE] text-xl font-medium font-title">
              Give the Coach a Head Start
            </h3>
            <p className="text-[#B7BCB6] text-sm max-w-4xl leading-relaxed">
              Already have a journal, personal story, or written biography? Upload it here to give your coach deeper context for your Personal DNA extraction. It’s optional now, and you can always add it later.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsBaselineModalOpen(true)}
          className="w-full sm:w-auto px-6 py-3 bg-[#FF7316] text-white rounded-full font-medium hover:bg-[#FF7316]/90 transition-all shrink-0 hover:scale-105 active:scale-95 text-center"
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

      {isIntroVideoOpen && (
        <IntroVideoModal onClose={() => setIsIntroVideoOpen(false)} />
      )}
    </main>
  );
}
