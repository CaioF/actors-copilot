"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dna, Monitor, Sparkles, FileText } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { MemoryRecordingBanner } from "@/components/memory-recording-banner";
import { HistoryUploadModal } from "@/components/history-upload-modal";
import { IntroVideoModal } from "@/components/intro-video-modal";
import { useAuth } from "@/lib/context/AuthContext";
import { getHasSeenIntroVideo, markHasSeenIntroVideo } from "@/lib/firestore.utils";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Main dashboard page showing the self-tape copilot workflow.
 * Renders the hero section, main action cards, memory recording banner, and baseline upload modal.
 * @returns The rendered dashboard page component
 */
export default function DashboardPage() {
  const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);
  const [isIntroVideoOpen, setIsIntroVideoOpen] = useState(false);
  const { user, loading } = useAuth();
  const checkedIntroUserIdRef = useRef<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      router.refresh();
      router.replace("/dashboard");
    }
  }, [sessionId, router]);

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
    <main className="flex flex-1 flex-col pb-12">
      <DashboardHeader title="My Self Tape Copilot" />

      <div className="px-4 sm:px-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden min-h-105 rounded-2xl bg-neutral-900 text-white ">
          <div className="absolute inset-0 z-0">
            <Image
              src="image1.png"
              alt="The Actors Copilot Background"
              fill
              className="object-cover object-center opacity-40"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/70 to-transparent" />
          </div>

          <div className="relative z-10 p-8 sm:p-12 max-w-2xl space-y-4">
            <h1 className="font-title text-4xl sm:text-5xl font-bold tracking-tight">
              My Acting Copilot
            </h1>
            <hr className="border-white/20 w-full" />

            <h2 className="text-xl sm:text-2xl font-semibold tracking-wider text-neutral-200 uppercase">
              CREATE. PERFORM. PRODUCE.
            </h2>

            <blockquote className="pt-2 italic text-neutral-300 text-sm sm:text-base border-l-2 border-primary pl-4">
              "Know who you are. Then play like it’s the only truth."
              <footer className="mt-1 font-normal not-italic text-xs text-neutral-400">
                — Stella Adler
              </footer>
            </blockquote>
          </div>
        </section>

        {/* Step Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Personal DNA */}
          <div className="group rounded-2xl bg-card border border-border overflow-hidden shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="relative h-48 w-full bg-neutral-800">
              <Image
                src="image2.png"
                alt="Personal DNA Upload"
                fill
                className="object-cover"
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-neutral-800 text-white flex items-center justify-center border-2 border-card shadow-sm">
                <Dna className="h-5 w-5" />
              </div>
            </div>

            <div className="p-6 pt-8 text-center flex-1 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  START HERE
                </span>
                <h3 className="font-title text-xl font-bold text-foreground mt-1">
                  Personal DNA Upload
                </h3>
                <div className="w-16 h-[1px] bg-border mx-auto my-2" />
                <p className="text-xs text-muted-foreground">Know your core.</p>
              </div>

              <Link
                href="/chat"
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Start building your DNA <Sparkles className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Audition Breakdown */}
          <div className="group rounded-2xl bg-card border border-border overflow-hidden shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="relative h-48 w-full bg-neutral-800">
              <Image
                src="image3.png"
                alt="Audition Breakdown"
                fill
                className="object-cover"
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-neutral-800 text-white flex items-center justify-center border-2 border-card shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="p-6 pt-8 text-center flex-1 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  GOT AN AUDITION?
                </span>
                <h3 className="font-title text-xl font-bold text-foreground mt-1">
                  Audition Breakdown
                </h3>
                <div className="w-16 h-[1px] bg-border mx-auto my-2" />
                <p className="text-xs text-muted-foreground">
                  Break it down. Own the room.
                </p>
              </div>

              <Link
                href="/auditions/new/brief"
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Upload Casting Brief and sides <Sparkles className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: Independent Study */}
          <div className="group rounded-2xl bg-card border border-border overflow-hidden shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div className="relative h-48 w-full bg-neutral-800">
              <Image
                src="image4.png"
                alt="Independent Study"
                fill
                className="object-cover"
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-neutral-800 text-white flex items-center justify-center border-2 border-card shadow-sm">
                <Monitor className="h-5 w-5" />
              </div>
            </div>

            <div className="p-6 pt-8 text-center flex-1 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Working on a scene?
                </span>
                <h3 className="font-title text-xl font-bold text-foreground mt-1">
                  Independent Study
                </h3>
                <div className="w-16 h-[1px] bg-border mx-auto my-2" />
                <p className="text-xs text-muted-foreground">
                  Train this scene. Elevate the story.
                </p>
              </div>

              <Link
                href="/auditions/new/sides"
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Start Scene Study <Monitor className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Memory Recording Banner */}
        <MemoryRecordingBanner />

        {/* Baseline Upload Banner */}
        <section className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="bg-primary/10 p-3 rounded-2xl shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground text-xl font-bold font-title">
                Give the Coach a Head Start
              </h3>
              <p className="text-muted-foreground text-sm max-w-4xl leading-relaxed mt-1">
                Already have a journal, personal story, or written biography? Upload it here to give your coach deeper context for your Personal DNA extraction. It’s optional now, and you can always add it later.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsBaselineModalOpen(true)}
            className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90 transition-all shrink-0 text-center"
          >
            Upload Baseline
          </button>
        </section>
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