"use client"

import { RefObject, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase"
import { Loader2, ArrowLeft, Printer } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import ReactMarkdown from "react-markdown"

// Importa o seu componente visual que desenha os cards verdes da IA
import { StepResult } from "@/components/auditions/step/step-result"

export default function AuditionDetailView() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const auditionId = params.id as string

  const [auditionData, setAuditionData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintDocument = useReactToPrint({
    contentRef: printRef, // Pega APENAS o nosso template oculto
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

  const fetchAuditionDetails = async (userPath: string, id: string) => {
    try {
      const db = getDb()
      const docRef = doc(db, `users/${userPath}/auditions/${id}`)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        setAuditionData(data)
        
        
      }
    } catch (err) {
      console.error("Error fetching audition:", err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0E8DC]">
        <Loader2 className="h-10 w-10 animate-spin text-[#E8721A] mb-4" />
        <p className="font-serif text-lg text-[#2C3328] animate-pulse">Loading breakdown...</p>
      </div>
    )
  }

  if (error || !auditionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0E8DC]">
        <h2 className="text-2xl font-serif text-[#2C3328] mb-4">Audition not found</h2>
        <button onClick={() => router.push("/auditions")} className="text-[#E8721A] hover:underline">
          Return to Auditions List
        </button>
      </div>
    )
  }

  return (
    <main className="flex-1 bg-[#F0E8DC] min-h-screen p-8">
      
      {/* HEADER CONTROLS  */}
      <div className="max-w-5xl mx-auto ">
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
      </div>

      <div className=" max-w-5xl mx-auto">
        {/* Title */}
        <div className=" mb-10">
          <h1 className="text-4xl font-serif text-[#2C3328]">{auditionData.project}</h1>
          <p className="text-xl text-[#E8721A] mt-2 font-medium">{auditionData.role}</p>
        </div>

        {/* result component */}
        <div className="">
          {auditionData.performanceMap ? (
             <StepResult data={auditionData.performanceMap} />
          ) : (
             <p className="text-center text-[#6B6B6B]">No performance map data found for this audition.</p>
          )}
        </div>
      </div>

       
      {/* hidden template for pdf printing */}
      <div className="hidden">
        <div ref={printRef} className="bg-white p-12 text-black max-w-[210mm] mx-auto font-serif">
          
          {/* Cabeçalho do Documento */}
          <div className="border-b-2 border-black pb-4 mb-8">
            <h1 className="text-4xl font-bold text-black">{auditionData?.project}</h1>
            <p className="text-xl text-gray-800 mt-2">{auditionData?.role}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-sans">The Actors Copilot • AI Performance Map</p>
          </div>

          {/* Intro Block */}
          {auditionData?.performanceMap?.intro && (
            <div className="mb-10 p-6 bg-gray-50 border-l-4 border-black break-inside-avoid">
              <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                <ReactMarkdown>{auditionData.performanceMap.intro}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Sections Loop */}
          <div className="space-y-10">
            {auditionData?.performanceMap?.sections.map((sec: any, idx: number) => (
              <div key={idx} className="break-inside-avoid">
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

          {/* Outro Block */}
          {auditionData?.performanceMap?.outro && (
            <div className="mt-12 pt-8 border-t border-black text-center break-inside-avoid">
              <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                <ReactMarkdown>{auditionData.performanceMap.outro}</ReactMarkdown>
              </div>
            </div>
          )}

        </div>
      </div>

    </main>
  )
}

