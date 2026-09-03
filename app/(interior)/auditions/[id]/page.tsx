"use client"

import { RefObject, useEffect, useMemo, useRef, useState, Suspense } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { logger } from '@/lib/logger';
import { Loader2, ArrowLeft, Printer, BookOpen, ClipboardList, CalendarDays, User, RefreshCw } from "lucide-react"
import { useReactToPrint } from "react-to-print"

import { StepResultSides } from "@/components/auditions/step/step-result"
import { StepResultBrief } from "@/components/auditions/step/step-result-brief"
import { PerformanceMapPrintBlock } from "@/components/auditions/step/performance-map-print-block"
import { calculateLocalDeadline } from "@/lib/time-utils"
import type { CriticalBriefFact } from "@/lib/audition-types"

interface PerformanceSection {
  title: string;
  items: string[];
}

interface PerformanceMap {
  intro?: string;
  sections: PerformanceSection[];
  outro?: string;
}

interface AuditionData {
  project: string;
  role: string;
  deadline?: string | null;
  auditionTimezone?: string | null;
  castingDirectorName?: string | null;
  performanceMap?: PerformanceMap;
  sidesPerformanceMap?: PerformanceMap | null;
  briefPerformanceMap?: PerformanceMap | null;
  criticalBriefFacts?: CriticalBriefFact[] | null;
  hasSides?: boolean;
  hasBrief?: boolean;
  analysisType?: "sides" | "brief";
}

export default function AuditionDetailView() {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <AuditionDetailContent />
    </Suspense>
  )
}

function AuditionDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const auditionId = params.id as string

  const [auditionData, setAuditionData] = useState<AuditionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const localDeadlineStr = useMemo(() => {
    if (!auditionData?.deadline || !auditionData?.auditionTimezone) return null;
    const actorTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return calculateLocalDeadline(auditionData.deadline, auditionData.auditionTimezone, actorTz);
  }, [auditionData?.deadline, auditionData?.auditionTimezone]);

  const hasBothAnalyses = (auditionData?.hasSides && auditionData?.hasBrief) || false;
  const hasNewSchema = auditionData?.hasSides !== undefined || auditionData?.hasBrief !== undefined;

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintDocument = useReactToPrint({
    contentRef: printRef, // hidden template reference
    documentTitle: auditionData ? `${auditionData.project}_Breakdown` : "Audition_Breakdown",
  });

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && auditionId) {
        const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor"
        const userPath = `${user.uid}_${firstName}`

        await fetchAuditionDetails(userPath, auditionId)
      } else {
        setError(true)
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [auditionId])

  /**
   * Fetches the full audition details from Firestore for the specified user and audition ID.
   * @param userPath - The user's unique path (uid_firstName format)
   * @param id - The unique identifier of the audition
   * @returns void (side effects: updates auditionData and isLoading state)
   * @async
   */
  const fetchAuditionDetails = async (userPath: string, id: string) => {
    try {
      const db = getDb()
      const docRef = doc(db, `users/${userPath}/auditions/${id}`)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const data = docSnap.data() as AuditionData
        setAuditionData(data)

      }
    } catch (err) {
      logger.error({ err, msg: 'Error fetching audition' })
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground transition-colors">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="font-title text-lg text-foreground animate-pulse">Loading breakdown...</p>
      </div>
    )
  }

  if (error || !auditionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground transition-colors">
        <h2 className="text-2xl font-title text-foreground mb-4">Audition not found</h2>
        <button onClick={() => router.push("/auditions")} className="text-primary hover:underline font-medium">
          Return to Auditions List
        </button>
      </div>
    )
  }
  const currentAnalysisType = auditionData.analysisType || "sides";
  const analysisLabel = currentAnalysisType === "brief" ? "Brief Breakdown" : "Sides Breakdown";

  return (
    <main className="flex flex-1 flex-col bg-background text-foreground transition-colors min-h-screen p-4 sm:p-8">

      {/* HEADER CONTROLS  */}
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-6 w-full">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Breakdown-type badge — capitalized for visual consistency */}
          <span className="px-3 py-1 rounded-full bg-primary text-[11px] text-primary-foreground uppercase tracking-wider font-semibold shadow-sm">
            {hasBothAnalyses ? "Sides + Brief" : analysisLabel}
          </span>

          {auditionData.hasSides && !auditionData.hasBrief && (
            <button
              onClick={() => router.push(`/auditions/new/brief?enrichAuditionId=${auditionId}`)}
              className="flex items-center gap-2 border border-border bg-card text-foreground hover:bg-muted px-4 py-2 rounded-full font-medium transition-colors text-sm shadow-sm"
            >
              <ClipboardList className="w-4 h-4" />
              Attach Brief
            </button>
          )}

          {/* Prominent 'Attach Sides' CTA to ensure high visibility in the header controls */}
          {auditionData.hasBrief && !auditionData.hasSides && (
            <button
              onClick={() => router.push(`/auditions/new/sides?enrichAuditionId=${auditionId}`)}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-full font-bold shadow-md hover:shadow-lg transition-all text-base"
            >
              <BookOpen className="w-5 h-5" />
              Attach Sides
            </button>
          )}

          <button
            onClick={handlePrintDocument}
            className="flex items-center gap-2 border border-border bg-card text-foreground hover:bg-muted px-5 py-2 rounded-full font-medium transition-colors text-sm shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Breakdown
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full">
        {/* Title & Tags */}
        <div className="mb-4">
          <div className="flex items-center">
            <h1 className="text-4xl font-title uppercase text-foreground">{auditionData.project}</h1>
          </div>
          <p className="text-xl text-primary font-semibold uppercase mt-1">{auditionData.role}</p>

          {/* Header metadata band — deadline + casting director, visible above BOTH analysis cards */}
          {(localDeadlineStr || auditionData.castingDirectorName) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {localDeadlineStr && (
                <div className="flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-4 py-2">
                  <CalendarDays className="text-primary w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Your Local Deadline:</span>
                  <span className="text-foreground font-semibold text-sm">{localDeadlineStr}</span>
                </div>
              )}
              {auditionData.castingDirectorName && (
                <div className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 shadow-sm">
                  <User className="text-muted-foreground w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Casting Director:</span>
                  <span className="text-foreground font-medium text-sm">{auditionData.castingDirectorName}</span>
                </div>
              )}
            </div>
          )}

          {/* Stale-analysis re-run banner — shown when both maps exist (the older one was generated without context of the newer one). */}
          {hasBothAnalyses && (
            <div className="mt-4 rounded-2xl bg-primary/10 border border-primary/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <RefreshCw className="text-primary w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Tighten the integration between your Sides and Brief</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    Whichever of these you uploaded first was generated without the other one as context. Re-upload that material to weave both together — character names, deadlines, and casting notes will line up across both analyses.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => router.push(`/auditions/new/sides?enrichAuditionId=${auditionId}`)}
                  className="text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/20 px-3 py-2 rounded-full transition-colors"
                >
                  Re-run Sides
                </button>
                <button
                  onClick={() => router.push(`/auditions/new/brief?enrichAuditionId=${auditionId}`)}
                  className="text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/20 px-3 py-2 rounded-full transition-colors"
                >
                  Re-run Brief
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DYNAMIC RESULT COMPONENT */}
        <div>
          {hasNewSchema ? (
            hasBothAnalyses ? (
              <div className="space-y-8">
                <div className="rounded-2xl bg-card p-4 border-l-4 border-primary border-t border-r border-b border-border shadow-sm">
                  <h2 className="text-lg font-bold font-title text-foreground">Sides Analysis</h2>
                </div>
                {auditionData.sidesPerformanceMap && (
                  <StepResultSides
                    data={{
                      ...auditionData.sidesPerformanceMap,
                      criticalBriefFacts: auditionData.criticalBriefFacts ?? undefined,
                    }}
                    onCoachClick={() =>
                      router.push(
                        `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides&coachType=character`
                      )
                    }
                  />
                )}
                <div className="rounded-2xl bg-card p-4 border-l-4 border-primary border-t border-r border-b border-border shadow-sm">
                  <h2 className="text-lg font-bold font-title text-foreground">Brief Analysis</h2>
                </div>
                {auditionData.briefPerformanceMap && (
                  <StepResultBrief
                    data={auditionData.briefPerformanceMap}
                    localDeadlineStr={localDeadlineStr}
                    
                  />
                )}
              </div>
            ) : auditionData.hasSides && auditionData.sidesPerformanceMap ? (
              <StepResultSides
                data={{
                  ...auditionData.sidesPerformanceMap,
                  criticalBriefFacts: auditionData.criticalBriefFacts ?? undefined,
                }}
                onCoachClick={() =>
                  router.push(
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides&coachType=character`
                  )
                }
              />
            ) : auditionData.hasBrief && auditionData.briefPerformanceMap ? (
              <StepResultBrief
                data={auditionData.briefPerformanceMap}
                localDeadlineStr={localDeadlineStr}
                
              />
            ) : auditionData.performanceMap ? (
              // Defensive: hasNewSchema is true but neither hasSides/hasBrief produced a card
              // (could happen if a doc has both booleans explicitly false alongside the legacy map).
              currentAnalysisType === "brief" ? (
                <StepResultBrief
                  data={auditionData.performanceMap}
                  
                />
              ) : (
                <StepResultSides
                  data={auditionData.performanceMap}
                  onCoachClick={() =>
                    router.push(
                      `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides&coachType=character`
                    )
                  }
                />
              )
            ) : (
              <p className="text-center text-muted-foreground">No performance map data found for this audition.</p>
            )
          ) : auditionData.performanceMap ? (
            currentAnalysisType === "brief" ? (
              <StepResultBrief
                data={auditionData.performanceMap}
                
              />
            ) : (
              <StepResultSides
                data={auditionData.performanceMap}
                onCoachClick={() =>
                  router.push(
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides&coachType=character`
                  )
                }
              />
            )
          ) : (
            <p className="text-center text-muted-foreground">No performance map data found for this audition.</p>
          )}
        </div>
      </div>

       
      {/* hidden template for pdf printing */}
      <div className="hidden">
        <div ref={printRef} className="bg-white p-12 text-black max-w-[210mm] mx-auto font-title">

          {/* Doc header */}
          <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold text-black uppercase">{auditionData?.project}</h1>
              <p className="text-xl text-gray-800 mt-2 uppercase">{auditionData?.role}</p>
              <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-sans">
                The Actors Copilot • AI Performance Map
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-sans font-bold">
                {hasBothAnalyses ? "Sides + Brief" : currentAnalysisType}
              </p>
            </div>
          </div>

          {hasNewSchema ? (
            hasBothAnalyses ? (
              <>
                <PerformanceMapPrintBlock
                  data={auditionData.sidesPerformanceMap}
                  heading="SIDES ANALYSIS"
                  accentColor="#FF7316"
                  keyPrefix="sides"
                  criticalFacts={auditionData.criticalBriefFacts ?? null}
                />
                <PerformanceMapPrintBlock
                  data={auditionData.briefPerformanceMap}
                  heading="BRIEF ANALYSIS"
                  accentColor="#E8721A"
                  keyPrefix="brief"
                />
              </>
            ) : auditionData.hasSides && auditionData.sidesPerformanceMap ? (
              <PerformanceMapPrintBlock
                data={auditionData.sidesPerformanceMap}
                heading="SIDES ANALYSIS"
                accentColor="#FF7316"
                keyPrefix="sides"
                criticalFacts={auditionData.criticalBriefFacts ?? null}
              />
            ) : auditionData.hasBrief && auditionData.briefPerformanceMap ? (
              <PerformanceMapPrintBlock
                data={auditionData.briefPerformanceMap}
                heading="BRIEF ANALYSIS"
                accentColor="#E8721A"
                keyPrefix="brief"
                criticalFacts={auditionData.criticalBriefFacts ?? null}
              />
            ) : auditionData.performanceMap ? (
              <PerformanceMapPrintBlock
                data={auditionData.performanceMap}
                heading={null}
                accentColor="black"
                keyPrefix="legacy"
              />
            ) : (
              <p className="text-center text-gray-500">No performance map data found for this audition.</p>
            )
          ) : (
            <PerformanceMapPrintBlock
              data={auditionData.performanceMap}
              heading={null}
              accentColor="black"
              keyPrefix="legacy"
            />
          )}

        </div>
      </div>

    </main>
  )
}
