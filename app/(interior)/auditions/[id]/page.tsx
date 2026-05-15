"use client"

import { RefObject, useEffect, useMemo, useRef, useState } from "react"
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

/**
 * Detailed view page for a single character breakdown.
 * Displays performance map data and provides print functionality.
 * @returns The rendered audition detail page
 */
export default function AuditionDetailView() {
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0E8DC]">
        <Loader2 className="h-10 w-10 animate-spin text-[#E8721A] mb-4" />
        <p className="font-title text-lg text-[#2C3328] animate-pulse">Loading breakdown...</p>
      </div>
    )
  }

  if (error || !auditionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0E8DC]">
        <h2 className="text-2xl font-title text-[#2C3328] mb-4">Audition not found</h2>
        <button onClick={() => router.push("/auditions")} className="text-[#E8721A] hover:underline">
          Return to Auditions List
        </button>
      </div>
    )
  }
  const currentAnalysisType = auditionData.analysisType || "sides";
  const analysisLabel = currentAnalysisType === "brief" ? "Brief Breakdown" : "Sides Breakdown";

  return (
    <main className="flex-1 bg-[#F0E8DC] min-h-screen p-8">

      {/* HEADER CONTROLS  */}
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#E8721A] transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Breakdown-type badge — capitalized for visual consistency */}
          <span className="px-3 py-1 rounded-full bg-[#E8721A] text-[11px] text-white uppercase tracking-wider font-semibold">
            {hasBothAnalyses ? "Sides + Brief" : analysisLabel}
          </span>

          {auditionData.hasSides && !auditionData.hasBrief && (
            <button
              onClick={() => router.push(`/auditions/new/brief?enrichAuditionId=${auditionId}`)}
              className="flex items-center gap-2 border border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0] px-4 py-2 rounded-full font-medium transition-colors text-sm"
            >
              <ClipboardList className="w-4 h-4" />
              Attach Brief
            </button>
          )}

          {auditionData.hasBrief && !auditionData.hasSides && (
            <button
              onClick={() => router.push(`/auditions/new/sides?enrichAuditionId=${auditionId}`)}
              className="flex items-center gap-2 border border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0] px-4 py-2 rounded-full font-medium transition-colors text-sm"
            >
              <BookOpen className="w-4 h-4" />
              Attach Sides
            </button>
          )}

          <button
            onClick={handlePrintDocument}
            className="flex items-center gap-2 border border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0] px-5 py-2 rounded-full font-medium transition-colors text-sm"
          >
            <Printer className="w-4 h-4" />
            Print Breakdown
          </button>
        </div>
      </div>

      <div className=" max-w-5xl mx-auto">
        {/* Title & Tags */}
        <div className="mb-4">
          <div className="flex items-center">
            <h1 className="text-4xl font-title uppercase text-[#2C3328]">{auditionData.project}</h1>
          </div>
          <p className="text-xl text-[#E8721A] font-medium uppercase">{auditionData.role}</p>

          {/* Header metadata band — deadline + casting director, visible above BOTH analysis cards */}
          {(localDeadlineStr || auditionData.castingDirectorName) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {localDeadlineStr && (
                <div className="flex items-center gap-2 rounded-full bg-[#FFF5F0] border border-[#FF7316]/30 px-4 py-2">
                  <CalendarDays className="text-[#FF7316] w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold text-[#FF7316] uppercase tracking-widest">Your Local Deadline:</span>
                  <span className="text-[#2C3328] font-semibold text-sm">{localDeadlineStr}</span>
                </div>
              )}
              {auditionData.castingDirectorName && (
                <div className="flex items-center gap-2 rounded-full bg-white border border-[#C7C0B5] px-4 py-2">
                  <User className="text-[#6B6B6B] w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest">Casting Director:</span>
                  <span className="text-[#2C3328] font-medium text-sm">{auditionData.castingDirectorName}</span>
                </div>
              )}
            </div>
          )}

          {/* Stale-analysis re-run banner — shown when both maps exist (the older one was generated without context of the newer one). */}
          {hasBothAnalyses && (
            <div className="mt-4 rounded-2xl bg-[#FFF5F0] border border-[#FF7316]/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <RefreshCw className="text-[#FF7316] w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#2C3328]">Tighten the integration between your Sides and Brief</p>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed mt-0.5">
                    Whichever of these you uploaded first was generated without the other one as context. Re-upload that material to weave both together — character names, deadlines, and casting notes will line up across both analyses.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => router.push(`/auditions/new/sides?enrichAuditionId=${auditionId}`)}
                  className="text-xs font-semibold border border-[#FF7316]/40 text-[#FF7316] hover:bg-[#FFE7D6] px-3 py-2 rounded-full transition-colors"
                >
                  Re-run Sides
                </button>
                <button
                  onClick={() => router.push(`/auditions/new/brief?enrichAuditionId=${auditionId}`)}
                  className="text-xs font-semibold border border-[#FF7316]/40 text-[#FF7316] hover:bg-[#FFE7D6] px-3 py-2 rounded-full transition-colors"
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
                <div className="rounded-2xl bg-[#FCFAF7] p-4 border-l-4 border-[#FF7316]">
                  <h2 className="text-lg font-bold text-[#2C3328]">Sides Analysis</h2>
                </div>
                {auditionData.sidesPerformanceMap && (
                  <StepResultSides
                    data={{
                      ...auditionData.sidesPerformanceMap,
                      criticalBriefFacts: auditionData.criticalBriefFacts ?? undefined,
                    }}
                    onCoachClick={() =>
                      router.push(
                        `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides`
                      )
                    }
                  />
                )}
                <div className="rounded-2xl bg-[#FCFAF7] p-4 border-l-4 border-[#E8721A]">
                  <h2 className="text-lg font-bold text-[#2C3328]">Brief Analysis</h2>
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
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides`
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
                      `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides`
                    )
                  }
                />
              )
            ) : (
              <p className="text-center text-[#6B6B6B]">No performance map data found for this audition.</p>
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
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}&analysisType=sides`
                  )
                }
              />
            )
          ) : (
            <p className="text-center text-[#6B6B6B]">No performance map data found for this audition.</p>
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
