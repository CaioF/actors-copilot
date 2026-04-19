"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Trash2, Save} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import ReactMarkdown from "react-markdown";
import { AuditionFormData, initialAuditionData, AuditionStep } from "@/lib/audition-types";
import { Stepper } from "./stepper";
import { StepBasics } from "./step/step-basic";
import { StepUpload } from "./step/step-upload";
import { StepReview } from "./step/step-review";
import { StepResultSides } from "./step/step-result";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { StepResultBrief } from "./step/step-result-brief";

interface PerformanceSection {
  title: string;
  items: string[];
}

interface AuditionAnalysisResult {
  intro?: string;
  sections: PerformanceSection[];
  outro?: string;
}

interface AuditionWizardProps {
  mode: "sides" | "brief";
}
/**
 * AuditionWizard Component
 * Multi-step wizard for creating audition breakdowns. Handles project info collection,
 * sides/brief upload, review, AI generation, and saving to Firestore.
 */
export function AuditionWizard({ mode }: AuditionWizardProps) {
  const router = useRouter(); // Used for redirecting after saving
  const [currentStep, setCurrentStep] = useState<AuditionStep>(1);
  const [formData, setFormData] = useState<AuditionFormData>(initialAuditionData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultData, setResultData] = useState<AuditionAnalysisResult | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- PRINTING SETUP ---
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintDocument = useReactToPrint({
    contentRef: printRef, // points to our hidden template
    documentTitle: formData.project ? `${formData.project}_Breakdown` : "Audition_Breakdown",
  });

  // --- AUTHENTICATION LISTENER ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Handlers para navegação
  /**
   * Navigates to the next step in the audition wizard.
   */
  const handleNext = () => setCurrentStep((prev) => Math.min(prev + 1, 4) as AuditionStep);

  /**
   * Navigates to the previous step in the audition wizard.
   */
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1) as AuditionStep);

  // Handler para atualizar dados do form de qualquer etapa
  /**
   * Updates the form data with new values while preserving existing data.
   * @param data - Partial audition form data to merge with existing state
   */
  const updateFormData = (data: Partial<AuditionFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleDelete = () => {
  if (window.confirm("Are you sure you want to delete this audition breakdown? This action cannot be undone.")) {
    setResultData(null);
    setCurrentStep(1); 
  }
};

  /**
   * Handles the generation of an audition breakdown.
   * Step 1: Smart-checks the DNA Vault and updates the Master Profile if needed.
   * Step 2: Generates the Audition Breakdown via API.
   */
  const handleGenerate = async () => {
    setCurrentStep(4); 
    setIsGenerating(true); 

    try {
      if (!currentUser) {
        alert("You must be logged in to generate a breakdown.");
        setCurrentStep(4);
        setIsGenerating(false);
        return;
      }

      // --- DYNAMIC PATH CALCULATION ---
      const actorName = currentUser.displayName ? currentUser.displayName.split(" ")[0] : "Actor";
      const firstName = currentUser.displayName 
        ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") 
        : "Actor";
      const userPath = `${currentUser.uid}_${firstName}`;

      const token = await currentUser.getIdToken();

      // STAGE 1: SMART DNA SYNTHESIS (Uses the cache logic we just built)
      const dnaResponse = await fetch('/api/dna/synthesize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ userPath: userPath })
      });
      
      // We wait for the backend to confirm the profile is ready (either cached or newly generated)
      await dnaResponse.json(); 

      // STAGE 2: GENERATE AUDITION BREAKDOWN
      const payload = new FormData();
      
      payload.append("projectType", formData.projectType || "cinematic"); // Defaults to cinematic if not set
      payload.append("project", formData.project);
      payload.append("role", formData.role);
      if (formData.deadline) payload.append("deadline", formData.deadline);
      
      if (mode === "sides") {
        payload.append("sidesText", formData.sidesText);
        if (formData.sidesFile) payload.append("sidesFile", formData.sidesFile);
      } else {
        payload.append("briefText", formData.briefText);
        if (formData.briefFile) payload.append("briefFile", formData.briefFile);
      }

      if (formData.sidesFile) payload.append("sidesFile", formData.sidesFile);
      if (formData.briefFile) payload.append("briefFile", formData.briefFile);

      // Pass the actor's info so the backend knows who to coach and where to find the profile
      payload.append("actorName", actorName);
      payload.append("userPath", userPath);

      const endpoint = mode === "sides" 
        ? "/api/auditions/analyze/sides" 
        : "/api/auditions/analyze/brief";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: payload, 
      });

      const data = await response.json();

      if (response.ok && data.data?.sections) { 
        setResultData(data.data as AuditionAnalysisResult); 
        setIsGenerating(false);
      } else {
        console.error("Server Error:", data.error);
        alert("Error processing files. Check console.");
        setCurrentStep(4);
        setIsGenerating(false);
      }

    } catch (error) {
      console.error("Request Error:", error);
      alert("Connection error with the server.");
      setCurrentStep(4);
      setIsGenerating(false);
    }
  };

  /**
   * Saves the generated audition breakdown to Firestore and redirects to the auditions page.
   */
  const handleSaveAndFinish = async () => {
    if (!currentUser) {
      alert("Please log in to save your audition.");
      return;
    }

    try {
      // --- DYNAMIC PATH CALCULATION ---
      // calculate the userPath exactly as we did in use-chat.ts to keep architecture consistent
      const firstName = currentUser.displayName 
        ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") 
        : "Actor";
      
      const userPath = `${currentUser.uid}_${firstName}`;

      // Point exactly to the user's auditions sub-collection
      const auditionsRef = collection(getDb(), `users/${userPath}/auditions`);
      
      // Save the generated breakdown alongside the basic project data
      await addDoc(auditionsRef, {
        project: formData.project,
        role: formData.role,
        deadline: formData.deadline || null,
        performanceMap: resultData, // The fully structured AI JSON
        analysisType: mode,
        createdAt: serverTimestamp(),
        status: "completed"
      });

      // Redirect back to the Dashboard
      router.push("/auditions");

    } catch (error) {
      console.error("Error saving audition to database:", error);
      alert("Failed to save the audition. Please try again.");
    }
  };


  return (
    <div className="flex flex-col flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-2 h-full">
      
      {/* Stepper  */}
      {currentStep < 4 && (
        <Stepper currentStep={currentStep} />
      )}

     
      {currentStep === 1 && (
        <div className="flex flex-col flex-1">
          <StepBasics data={formData} updateData={updateFormData} />
          
          {/*  Next button */}
          <div className="flex justify-end mt-12 mb-8">
            <button 
              onClick={handleNext} 
              className="bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-3 rounded-full font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SIDES */}
      {currentStep === 2 && (
        <div className="flex flex-col flex-1">
          <StepUpload 
            title={mode === "sides" ? "Upload Sides" : "Upload Character Brief"}
            description={mode === "sides" 
              ? "Upload the script pages (Sides) for this audition." 
              : "Upload the casting breakdown, character description, or director's notes."}
            file={mode === "sides" ? formData.sidesFile : formData.briefFile}
            text={mode === "sides" ? formData.sidesText : formData.briefText}
            onFileChange={(file) => mode === "sides" 
              ? updateFormData({ sidesFile: file }) 
              : updateFormData({ briefFile: file })
            }
            onTextChange={(text) => mode === "sides" 
              ? updateFormData({ sidesText: text }) 
              : updateFormData({ briefText: text })
            }
            />
          <div className="flex justify-between mt-12 mb-8">
            <button onClick={handleBack} className="text-[#FF7316] hover:text-[#E66814] font-medium transition-colors px-4 py-2">Back</button>
            <button onClick={handleNext} className="bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-3 rounded-full font-medium transition-colors">Next</button>
          </div>
        </div>
      )}
      
      {/* STEP 3: REVIEW */}
      {currentStep === 3 && (
        <div className="flex flex-col flex-1">
          <StepReview data={formData} mode={mode} />

          <div className="flex justify-between items-center mt-12 mb-8">
            <button 
              onClick={handleBack} 
              className="text-[#FF7316] hover:text-[#E66814] font-medium transition-colors px-4 py-2"
            >
              Back to edit
            </button>
            <button 
              onClick={handleGenerate} 
              className="bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              Generate Breakdown
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: LOADING OR RESULT */}
      {currentStep === 4 && (
        <div className={`flex-1 flex flex-col w-full h-full ${!isGenerating && resultData ? 'bg-[#F5EFE6] -mx-4 md:-mx-8 px-4 md:px-8 py-8 min-h-screen' : ''}`}>
          {isGenerating ? (
            <div className="flex flex-col flex-1 animate-in fade-in duration-500">
              {/* Dark loading card */}
              <div className="rounded-3xl bg-[#424842] shadow-xl text-center flex flex-col items-center justify-center w-full max-w-6xl mx-auto py-32 px-8">
                
                {/* Animated Spinner */}
                <svg className="animate-spin h-14 w-14 text-[#FF7316] mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                
                <h2 className="text-2xl font-title text-[#EADDCE] mb-3">Generating your breakdown...</h2>
                <p className="text-[#B7BCB6] text-base">This usually takes a few seconds</p>
              
              </div>
            </div>
          ) : resultData ? (
            <div className="flex flex-col animate-in fade-in duration-700 max-w-7xl mx-auto w-full">

               {/* --- FIGMA-ALIGNED HEADER --- */}
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 w-full border-b border-[#D0D4D0]/50 pb-6">
                 <div>
                   <h1 className="text-[32px] font-title text-[#2C3328] leading-tight mb-1">
                     {formData.role || "Audition Breakdown"}
                   </h1>
                   <p className="text-[#646A64] text-[15px] mb-3">
                     Lead · {formData.project || "Audition Project"} 
                   </p>
                 </div>

                 <div className="flex gap-3 mt-4 sm:mt-0">
                  {/* Delete Action */}
                   <button 
                     type="button"
                     onClick={handleDelete}
                     className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#D0D4D0] text-[#646A64] text-sm font-medium hover:bg-[#FCFAF7] transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                     Delete
                   </button>
                   {/* Print Action */}
                   <button 
                     onClick={handlePrintDocument}
                     className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:bg-white transition-colors"
                   >
                     <Printer className="w-4 h-4" />
                     Print
                   </button>
                   
                   {/* Save Action */}
                   <button 
                     onClick={handleSaveAndFinish}
                     className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#FF7316] text-white text-sm font-medium hover:bg-[#E5630F] transition-colors shadow-sm"
                   >
                    <Save className="w-4 h-4" />
                     Save Output
                   </button>
                 </div>
               </div>

               {/* --- MAIN UI RENDERER --- */}
               mode === "sides" ? <StepResultSides data={resultData} /> : <StepResultBrief data={resultData} />

               {/* --- HIDDEN PRINT TEMPLATE --- */}
               <div className="hidden">
                 <div ref={printRef} className="bg-white p-12 text-black max-w-[210mm] mx-auto font-title">
                   
                   {/* Header */}
                   <div className="border-b-2 border-black pb-4 mb-8">
                     <h1 className="text-4xl font-bold text-black">{formData.project || "Audition Project"}</h1>
                     <p className="text-xl text-gray-800 mt-2">{formData.role || "Character Role"}</p>
                     <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-sans">The Actors Copilot • AI Performance Map</p>
                   </div>

                   {/* Intro Block */}
                   {resultData?.intro && (
                     <div className="mb-10 p-6 bg-gray-50 border-l-4 border-black break-inside-avoid">
                       <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic prose-p:leading-relaxed">
                         <ReactMarkdown>{resultData.intro}</ReactMarkdown>
                       </div>
                     </div>
                   )}

                   {/* Sections Loop */}
                   <div className="space-y-10">
                     {resultData?.sections?.map((sec: PerformanceSection, idx: number) => (
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

                   {/* Final Block */}
                   {resultData?.outro && (
                     <div className="mt-12 pt-8 border-t border-black text-center break-inside-avoid">
                       <div className="prose max-w-none prose-p:text-black prose-strong:text-black italic">
                         <ReactMarkdown>{resultData.outro}</ReactMarkdown>
                       </div>
                     </div>
                   )}
                 </div>
               </div>

            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}