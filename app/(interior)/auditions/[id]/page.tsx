"use client"

import { RefObject, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { logger } from '@/lib/logger';
import { Loader2, ArrowLeft, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import ReactMarkdown from "react-markdown"

import { StepResultSides } from "@/components/auditions/step/step-result"
import { StepResultBrief } from "@/components/auditions/step/step-result-brief"
import { calculateLocalDeadline } from "@/lib/time-utils"

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
  performanceMap?: PerformanceMap;
  sidesPerformanceMap?: PerformanceMap | null;
  briefPerformanceMap?: PerformanceMap | null;
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

  return (
    <main className="flex-1 bg-[#F0E8DC] min-h-screen p-8">
      
      {/* HEADER CONTROLS  */}
      <div className="max-w-5xl mx-auto  flex justify-between  mb-8">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#E8721A] transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>

        <button 
          onClick={handlePrintDocument}
          className="flex items-center gap-2 border border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0] px-5 py-2 rounded-full font-medium transition-colors text-sm"
        >
          <Printer className="w-4 h-4" />
          Print Breakdown
        </button>

        {/* Visual indicator of the breakdown type */}
            <span className="px-3 mt-2 py-1 rounded-full bg-[#E8721A] text-[11px] text-white uppercase tracking-wider font-semibold">
              {currentAnalysisType} Breakdown
            </span>
      </div>

      <div className=" max-w-5xl mx-auto">
        {/* Title & Tags */}
        <div className="mb-2">
          <div className="flex items-center">
            <h1 className="text-4xl font-title text-[#2C3328]">{auditionData.project}</h1>
          </div>
          <p className="text-xl text-[#E8721A] font-medium">{auditionData.role}</p>
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
                    data={auditionData.sidesPerformanceMap}
                    onCoachClick={() =>
                      router.push(
                        `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}`
                      )
                    }
                  />
                )}
                <div className="rounded-2xl bg-[#FCFAF7] p-4 border-l-4 border-[#E8721A]">
                  <h2 className="text-lg font-bold text-[#2C3328]">Brief Analysis</h2>
                </div>
                {auditionData.briefPerformanceMap && (
                  <StepResultBrief data={auditionData.briefPerformanceMap} localDeadlineStr={localDeadlineStr} />
                )}
              </div>
            ) : auditionData.hasSides && auditionData.sidesPerformanceMap ? (
              <StepResultSides
                data={auditionData.sidesPerformanceMap}
                onCoachClick={() =>
                  router.push(
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}`
                  )
                }
              />
            ) : auditionData.hasBrief && auditionData.briefPerformanceMap ? (
              <StepResultBrief data={auditionData.briefPerformanceMap} localDeadlineStr={localDeadlineStr} />
            ) : (
              <p className="text-center text-[#6B6B6B]">No performance map data found for this audition.</p>
            )
          ) : auditionData.performanceMap ? (
            currentAnalysisType === "brief" ? (
              <StepResultBrief data={auditionData.performanceMap} />
            ) : (
              <StepResultSides
                data={auditionData.performanceMap}
                onCoachClick={() =>
                  router.push(
                    `/acting-coach?auditionId=${encodeURIComponent(auditionId)}&project=${encodeURIComponent(auditionData.project)}&role=${encodeURIComponent(auditionData.role)}`
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
              <h1 className="text-4xl font-bold text-black">{auditionData?.project}</h1>
              <p className="text-xl text-gray-800 mt-2">{auditionData?.role}</p>
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
                {/* SIDES ANALYSIS PRINT */}
                <div className="mb-12">
                  <div className="border-b-2 border-[#FF7316] pb-2 mb-6">
                    <h2 className="text-2xl font-bold text-black">SIDES ANALYSIS</h2>
                  </div>
                  {auditionData.sidesPerformanceMap?.intro && (
                    <div className="mb-10 p-6 bg-gray-50 border-l-4 border-[#FF7316] break-inside-avoid">
                      <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                        <ReactMarkdown>{auditionData.sidesPerformanceMap.intro}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  <div className="space-y-10 mt-10">
                    {auditionData.sidesPerformanceMap?.sections.map((sec: PerformanceSection, idx: number) => (
                      <div key={`sides-${idx}`} className="break-inside-avoid pt-8">
                        <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
                          {sec.title}
                        </h3>
                        <ul className="space-y-4">
                          {sec.items.map((item: string, i: number) => (
                            <li key={`sides-${i}`} className="flex items-start text-black">
                              <span className="mr-4 text-black font-bold text-lg">•</span>
                              <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                                <ReactMarkdown>{item}</ReactMarkdown>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {auditionData.sidesPerformanceMap?.outro && (
                    <div className="mt-12 pt-8 border-t border-[#FF7316] text-center break-inside-avoid">
                      <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                        <ReactMarkdown>{auditionData.sidesPerformanceMap.outro}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* BRIEF ANALYSIS PRINT */}
                <div className="mb-12">
                  <div className="border-b-2 border-[#E8721A] pb-2 mb-6">
                    <h2 className="text-2xl font-bold text-black">BRIEF ANALYSIS</h2>
                  </div>
                  {auditionData.briefPerformanceMap?.intro && (
                    <div className="mb-10 p-6 bg-gray-50 border-l-4 border-[#E8721A] break-inside-avoid">
                      <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                        <ReactMarkdown>{auditionData.briefPerformanceMap.intro}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  <div className="space-y-10 mt-10">
                    {auditionData.briefPerformanceMap?.sections.map((sec: PerformanceSection, idx: number) => (
                      <div key={`brief-${idx}`} className="break-inside-avoid pt-8">
                        <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
                          {sec.title}
                        </h3>
                        <ul className="space-y-4">
                          {sec.items.map((item: string, i: number) => (
                            <li key={`brief-${i}`} className="flex items-start text-black">
                              <span className="mr-4 text-black font-bold text-lg">•</span>
                              <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                                <ReactMarkdown>{item}</ReactMarkdown>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {auditionData.briefPerformanceMap?.outro && (
                    <div className="mt-12 pt-8 border-t border-[#E8721A] text-center break-inside-avoid">
                      <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                        <ReactMarkdown>{auditionData.briefPerformanceMap.outro}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : auditionData.hasSides && auditionData.sidesPerformanceMap ? (
              <>
                <div className="border-b-2 border-[#FF7316] pb-2 mb-6">
                  <h2 className="text-2xl font-bold text-black">SIDES ANALYSIS</h2>
                </div>
                {auditionData.sidesPerformanceMap.intro && (
                  <div className="mb-10 p-6 bg-gray-50 border-l-4 border-[#FF7316] break-inside-avoid">
                    <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                      <ReactMarkdown>{auditionData.sidesPerformanceMap.intro}</ReactMarkdown>
                    </div>
                  </div>
                )}
                <div className="space-y-10 mt-10">
                  {auditionData.sidesPerformanceMap.sections.map((sec: PerformanceSection, idx: number) => (
                    <div key={idx} className="break-inside-avoid pt-8">
                      <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
                        {sec.title}
                      </h3>
                      <ul className="space-y-4">
                        {sec.items.map((item: string, i: number) => (
                          <li key={i} className="flex items-start text-black">
                            <span className="mr-4 text-black font-bold text-lg">•</span>
                            <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                              <ReactMarkdown>{item}</ReactMarkdown>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {auditionData.sidesPerformanceMap.outro && (
                  <div className="mt-12 pt-8 border-t border-[#FF7316] text-center break-inside-avoid">
                    <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                      <ReactMarkdown>{auditionData.sidesPerformanceMap.outro}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            ) : auditionData.hasBrief && auditionData.briefPerformanceMap ? (
              <>
                <div className="border-b-2 border-[#E8721A] pb-2 mb-6">
                  <h2 className="text-2xl font-bold text-black">BRIEF ANALYSIS</h2>
                </div>
                {auditionData.briefPerformanceMap.intro && (
                  <div className="mb-10 p-6 bg-gray-50 border-l-4 border-[#E8721A] break-inside-avoid">
                    <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                      <ReactMarkdown>{auditionData.briefPerformanceMap.intro}</ReactMarkdown>
                    </div>
                  </div>
                )}
                <div className="space-y-10 mt-10">
                  {auditionData.briefPerformanceMap.sections.map((sec: PerformanceSection, idx: number) => (
                    <div key={idx} className="break-inside-avoid pt-8">
                      <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
                        {sec.title}
                      </h3>
                      <ul className="space-y-4">
                        {sec.items.map((item: string, i: number) => (
                          <li key={i} className="flex items-start text-black">
                            <span className="mr-4 text-black font-bold text-lg">•</span>
                            <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                              <ReactMarkdown>{item}</ReactMarkdown>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {auditionData.briefPerformanceMap.outro && (
                  <div className="mt-12 pt-8 border-t border-[#E8721A] text-center break-inside-avoid">
                    <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                      <ReactMarkdown>{auditionData.briefPerformanceMap.outro}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-gray-500">No performance map data found for this audition.</p>
            )
          ) : (
            <>
              {/* Legacy single-analysis print */}
              {auditionData?.performanceMap?.intro && (
                <div className="mb-10 p-6 bg-gray-50 border-l-4 border-black break-inside-avoid">
                  <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                    <ReactMarkdown>{auditionData.performanceMap.intro}</ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="space-y-10 mt-10">
                {auditionData?.performanceMap?.sections.map((sec: PerformanceSection, idx: number) => (
                  <div key={idx} className="break-inside-avoid pt-8">
                    <h3 className="text-2xl font-bold text-black border-b border-gray-300 pb-2 mb-4">
                      {sec.title}
                    </h3>
                    <ul className="space-y-4">
                      {sec.items.map((item: string, i: number) => (
                        <li key={i} className="flex items-start text-black">
                          <span className="mr-4 text-black font-bold text-lg">•</span>
                          <div className="prose max-w-none prose-p:text-black prose-strong:text-black prose-p:m-0 prose-p:leading-relaxed">
                            <ReactMarkdown>{item}</ReactMarkdown>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {auditionData?.performanceMap?.outro && (
                <div className="mt-12 pt-8 border-t border-black text-center break-inside-avoid">
                  <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                    <ReactMarkdown>{auditionData.performanceMap.outro}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

    </main>
  )
}

