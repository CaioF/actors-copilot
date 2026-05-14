"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Trash2, Save, CalendarDays, User as UserIcon , RefreshCcw} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { AuditionFormData, initialAuditionData, AuditionStep, CriticalBriefFact } from "@/lib/audition-types";
import { Stepper } from "./stepper";
import { StepBasics } from "./step/step-basic";
import { StepUpload } from "./step/step-upload";
import { StepReview } from "./step/step-review";
import { PerformanceMapPrintBlock } from "./step/performance-map-print-block";
import { StepResultSides } from "./step/step-result";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, updateDoc, getDoc, getDocs, doc, query, where, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { StepResultBrief } from "./step/step-result-brief";
import { logger } from '@/lib/logger';
import { calculateLocalDeadline } from "@/lib/time-utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PerformanceSection {
  title: string;
  items: string[];
}

interface AuditionAnalysisResult {
  intro?: string;
  sections: PerformanceSection[];
  outro?: string;
  criticalBriefFacts?: CriticalBriefFact[];
}

interface AuditionWizardProps {
  mode: "sides" | "brief";
  auditionId?: string;
}
/**
 * AuditionWizard Component
 * Multi-step wizard for creating character breakdowns. Handles project info collection,
 * sides/brief upload, review, AI generation, and saving to Firestore.
 */
export function AuditionWizard({ mode, auditionId }: AuditionWizardProps) {
  const router = useRouter(); // Used for redirecting after saving
  const [currentStep, setCurrentStep] = useState<AuditionStep>(1);
  const [formData, setFormData] = useState<AuditionFormData>(initialAuditionData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultData, setResultData] = useState<AuditionAnalysisResult | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [localDeadlineStr, setLocalDeadlineStr] = useState<string | null>(null);
  const [pendingDup, setPendingDup] = useState<{
    existingId: string;
    nextAction: "save" | "coach";
  } | null>(null);
  const { toast } = useToast();

  const isStandaloneScene = mode === "sides" && !auditionId;

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

  useEffect(() => {
    if (!auditionId || !currentUser) return;

    const firstName = currentUser.displayName
      ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
      : "Actor";
    const userPath = `${currentUser.uid}_${firstName}`;

    const prefillAudition = async () => {
      try {
        const docRef = doc(getDb(), `users/${userPath}/auditions/${auditionId}`);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return;

        const data = docSnap.data();
        setFormData((prev) => ({
          ...prev,
          project: data.project || "",
          role: data.role || "",
          deadline: data.deadline || "",
          auditionTimezone: data.auditionTimezone || "",
          castingDirectorName: data.castingDirectorName || "",
        }));
      } catch (error) {
        logger.warn({ err: error, msg: "Failed to pre-fill audition enrichment data" });
      }
    };

    void prefillAudition();
  }, [auditionId, currentUser]);

  // Handlers para navegação
  /**
   * Navigates to the next step in the audition wizard.
   */
  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setCurrentStep((prev) => Math.min(prev + 1, 4) as AuditionStep);
  };

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
  if (window.confirm("Are you sure you want to delete this character breakdown? This action cannot be undone.")) {
    setResultData(null);
    setCurrentStep(1); 
  }
};

  /**
   * Returns the first missing prerequisite for Generate Breakdown,
   * or null when everything required is present. Used both to disable
   * the button and to surface a clear pre-flight toast.
   */
  const findMissingPrerequisite = (): { step: AuditionStep; title: string; description: string } | null => {
    if (!formData.project.trim()) {
      return {
        step: 1,
        title: "Project name is required",
        description: "Add the project name on Step 1 — without it the AI can't tailor the breakdown to your audition.",
      };
    }
    if (!formData.role.trim()) {
      return {
        step: 1,
        title: "Role name is required",
        description: "Add the character/role name on Step 1 — the entire breakdown is built around this character.",
      };
    }
    if (mode === "sides" && !formData.sidesText.trim() && !formData.sidesFile) {
      return {
        step: 2,
        title: "We need your sides",
        description: "Upload a PDF/.docx of your sides on Step 2, or paste the script text into the box. Without script content there's nothing to break down.",
      };
    }
    if (mode === "brief" && !formData.briefText.trim() && !formData.briefFile) {
      return {
        step: 2,
        title: "We need the casting brief",
        description: "Upload the casting brief on Step 2, or paste the brief text into the box. Without it the AI has no instructions to extract.",
      };
    }
    return null;
  };

  const canGenerate = findMissingPrerequisite() === null;

  /**
   * Handles the generation of an character breakdown.
   * Step 1: Smart-checks the DNA Vault and updates the Master Profile if needed.
   * Step 2: Generates the character breakdown via API.
   */
  const handleGenerate = async (isRegeneration: boolean = false) => {
    // Pre-flight: if anything required is missing, bounce back to the right
    // step with a clear explanation BEFORE we kick the user into the long
    // generation spinner only to fail with a vague API error.
    const missing = findMissingPrerequisite();
    if (missing) {
      toast({
        variant: "destructive",
        title: missing.title,
        description: missing.description,
      });
      setCurrentStep(missing.step);
      return;
    }

    if (!isRegeneration) {
        setCurrentStep(4);
    }
    setIsGenerating(true);

    const actorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (formData.deadline && formData.auditionTimezone) {
      const converted = calculateLocalDeadline(
        formData.deadline,
        formData.auditionTimezone,
        actorTimezone
      );
      setLocalDeadlineStr(converted);
    } else {
      setLocalDeadlineStr(null);
    }

    try {
      if (!currentUser) {
        toast({
          variant: "destructive",
          title: "Please log in to generate",
          description: "Your DNA profile and saved auditions are tied to your account — log in and try Generate Breakdown again.",
        });
        setCurrentStep(3);
        setIsGenerating(false);
        return;
      }

      const actorName = currentUser.displayName ? currentUser.displayName.split(" ")[0] : "Actor";
      const firstName = currentUser.displayName
        ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
        : "Actor";
      const userPath = `${currentUser.uid}_${firstName}`;

      const token = await currentUser.getIdToken();

      let priorSidesSummary = "";
      let priorBriefSummary = "";
      let criticalBriefFactsPayload = "";

      if (auditionId) {
        try {
          const docRef = doc(getDb(), `users/${userPath}/auditions/${auditionId}`);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const existing = docSnap.data() as {
              sidesPerformanceMap?: AuditionAnalysisResult | null;
              briefPerformanceMap?: AuditionAnalysisResult | null;
              criticalBriefFacts?: CriticalBriefFact[] | null;
            };

            const complementaryMap = mode === "brief"
              ? existing.sidesPerformanceMap
              : existing.briefPerformanceMap;

            if (complementaryMap) {
              const summaryParts: string[] = [];

              if (complementaryMap.intro) {
                summaryParts.push(complementaryMap.intro);
              }

              complementaryMap.sections.forEach((section) => {
                if (section.title) {
                  summaryParts.push(section.title);
                }

                section.items.forEach((item) => {
                  summaryParts.push(`- ${item}`);
                });
              });

              if (complementaryMap.outro) {
                summaryParts.push(complementaryMap.outro);
              }

              const summaryText = summaryParts.join("\n").substring(0, 1500).trim();

              if (mode === "brief") {
                priorSidesSummary = summaryText;
              } else {
                priorBriefSummary = summaryText;
              }
            }

            // When generating sides for an audition that already has brief-derived
            // critical facts, send them through their own non-lossy structured channel
            // so they survive into the sides prompt and resulting analysis.
            if (mode === "sides" && existing.criticalBriefFacts && existing.criticalBriefFacts.length > 0) {
              criticalBriefFactsPayload = JSON.stringify(existing.criticalBriefFacts);
            }
          }
        } catch (error) {
          logger.warn({ err: error, msg: "Failed to fetch complementary enrichment summary" });
        }
      }

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

      // STAGE 2: GENERATE character breakdown
      const payload = new FormData();

      payload.append("projectType", formData.projectType || "cinematic"); // Defaults to cinematic if not set
      payload.append("project", formData.project);
      payload.append("role", formData.role);
      if (formData.deadline) payload.append("deadline", formData.deadline);
      if (formData.auditionTimezone) payload.append("auditionTimezone", formData.auditionTimezone);
      if (formData.castingDirectorName?.trim()) payload.append("castingDirectorName", formData.castingDirectorName.trim());
      payload.append("actorTimezone", actorTimezone);

      if (mode === "sides") {
        payload.append("sidesText", formData.sidesText);
        if (formData.sidesFile) payload.append("sidesFile", formData.sidesFile);
      } else {
        payload.append("briefText", formData.briefText);
        if (formData.briefFile) payload.append("briefFile", formData.briefFile);
      }

      payload.append("actorName", actorName);
      payload.append("userPath", userPath);
      if (priorSidesSummary) payload.append("priorSidesSummary", priorSidesSummary);
      if (priorBriefSummary) payload.append("priorBriefSummary", priorBriefSummary);
      if (criticalBriefFactsPayload) payload.append("criticalBriefFactsPayload", criticalBriefFactsPayload);

      if (isRegeneration && resultData) {
        // We stringify the critical sections to give the AI context of what to avoid/oppose
        const briefPreviousTake = resultData.sections
            .map(s => `${s.title}: ${s.items.join(" ")}`)
            .join("\n")
            .substring(0, 2000); // Keep it within reasonable token limits
            
        payload.append("previousTake", briefPreviousTake);
      }

      const isStandaloneScene = mode === "sides" && !auditionId;
      payload.append("isStandalone", isStandaloneScene.toString());

      const endpoint = mode === "sides"
        ? "/api/auditions/analyzeSides"
        : "/api/auditions/analyzeBrief";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ err: errorText, msg: 'API Error' });
        throw new Error(`Falha na requisição: ${response.status}`);
      }

      const data = await response.json();

      if (response.ok && data.data?.sections) {
        setResultData(data.data as AuditionAnalysisResult);
        setIsGenerating(false);
      } else {
        logger.error({ err: data.error, msg: 'Server Error' });
        toast({
          variant: "destructive",
          title: "We couldn't generate that breakdown",
          description: "The AI returned an error. Most often this means the file couldn't be read — go back to the upload step and try a clean PDF or .docx (or paste the text directly).",
        });
        setCurrentStep(2);
        setIsGenerating(false);
      }

    } catch (error) {
      logger.error({ err: error, msg: 'Request Error' });
      toast({
        variant: "destructive",
        title: "Couldn't reach the server",
        description: "Check your internet connection and try Generate Breakdown again. If it keeps failing, your file may be too large or the server may be busy.",
      });
      setCurrentStep(3);
      setIsGenerating(false);
    }
  };

  const getUserPath = () => {
    if (!currentUser) return null;
    const firstName = currentUser.displayName
      ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
      : "Actor";
    return `${currentUser.uid}_${firstName}`;
  };

  // Trimmed project/role so the values stored in Firestore match exactly what the
  // dedup query (findDuplicateId) compares against — otherwise "Hamlet " (trailing
  // space) saves as one doc but never matches the next "Hamlet" lookup.
  const newAuditionDoc = () => ({
    project: formData.project.trim(),
    role: formData.role.trim(),
    deadline: formData.deadline || null,
    auditionTimezone: formData.auditionTimezone || null,
    actorLocalDeadline: localDeadlineStr,
    castingDirectorName: formData.castingDirectorName?.trim() || null,
    performanceMap: resultData,
    analysisType: mode,
    sidesPerformanceMap: mode === "sides" ? resultData : null,
    briefPerformanceMap: mode === "brief" ? resultData : null,
    criticalBriefFacts: resultData?.criticalBriefFacts ?? null,
    hasSides: mode === "sides",
    hasBrief: mode === "brief",
    createdAt: serverTimestamp(),
    status: "completed",
  });

  /**
   * Builds the Firestore update payload for enrichment mode.
   * Merges updated audition metadata (project/role/deadline/timezone/castingDirectorName)
   * with the new performance map so enrichment saves keep the full doc in sync.
   */
  const buildMergeUpdate = (existing: Record<string, unknown>) => {
    // Critical brief facts come from the brief analysis. On brief saves we overwrite
    // with the freshly generated facts; on sides saves we preserve whatever was
    // stored previously so a later sides re-run never erases brief-derived facts.
    const existingFacts =
      (existing as { criticalBriefFacts?: CriticalBriefFact[] | null }).criticalBriefFacts ?? null;
    const nextCriticalBriefFacts =
      mode === "brief" ? resultData?.criticalBriefFacts ?? null : existingFacts;

    return {
      ...existing,
      // Keep metadata in sync with any edits made during enrichment
      project: formData.project.trim(),
      role: formData.role.trim(),
      deadline: formData.deadline || null,
      auditionTimezone: formData.auditionTimezone || null,
      actorLocalDeadline: localDeadlineStr,
      castingDirectorName: formData.castingDirectorName?.trim() || null,
      criticalBriefFacts: nextCriticalBriefFacts,
      // Merge the newly generated performance map
      ...(mode === "sides"
        ? { sidesPerformanceMap: resultData, hasSides: true }
        : { briefPerformanceMap: resultData, hasBrief: true }),
    };
  };

  /**
   * Returns the id of an existing audition matching project+role+analysisType, or null.
   * Returns null when project/role are empty (drafts), or when the dedupe index isn't ready.
   * Skipped entirely in enrichment mode (`auditionId` prop set).
   */
  const findDuplicateId = async (
    auditionsRef: ReturnType<typeof collection>
  ): Promise<string | null> => {
    if (auditionId) return null;
    const trimmedProject = formData.project.trim();
    const trimmedRole = formData.role.trim();
    if (!trimmedProject || !trimmedRole) return null;
    try {
      const dedupeQuery = query(
        auditionsRef,
        where("project", "==", trimmedProject),
        where("role", "==", trimmedRole),
        where("analysisType", "==", mode)
      );
      const dedupeSnap = await getDocs(dedupeQuery);
      if (dedupeSnap.docs.length > 0) return dedupeSnap.docs[0].id;
      return null;
    } catch (error) {
      // Firestore index not ready — gracefully fall back to addDoc
      logger.warn({ err: error, msg: 'Dedupe query failed, proceeding with addDoc' });
      return null;
    }
  };

  /**
   * Persist the audition (addDoc or merge updateDoc) and redirect to the auditions list.
   * Assumes dedupe has already been resolved.
   */
  const performSave = async () => {
    const userPath = getUserPath();
    if (!userPath) return;

    try {
      const auditionsRef = collection(getDb(), `users/${userPath}/auditions`);

      if (auditionId) {
        const docRef = doc(getDb(), `users/${userPath}/auditions/${auditionId}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const existing = docSnap.data();
          await updateDoc(docRef, buildMergeUpdate(existing));
        } else {
          await addDoc(auditionsRef, newAuditionDoc());
        }
      } else {
        await addDoc(auditionsRef, newAuditionDoc());
      }

      toast({
        title: "Audition saved",
        description: `'${formData.project}' as '${formData.role}' is saved to your auditions.`,
      });
      router.push("/auditions");
    } catch (error) {
      logger.error({ err: error, msg: 'Error saving audition to database' });
      toast({
        variant: "destructive",
        title: "Couldn't save your audition",
        description: "Something blocked the save (network or permissions). Your breakdown is still on screen — try Save Output again in a moment.",
      });
    }
  };

  /**
   * Persist the audition and navigate to the acting-coach with auditionId/project/role/analysisType.
   * Assumes dedupe has already been resolved.
   */
  const performCoach = async () => {
    const userPath = getUserPath();
    if (!userPath) return;

    try {
      const auditionsRef = collection(getDb(), `users/${userPath}/auditions`);
      let docRefId: string;

      if (auditionId) {
        const docRef = doc(getDb(), `users/${userPath}/auditions/${auditionId}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const existing = docSnap.data();
          await updateDoc(docRef, buildMergeUpdate(existing));
          docRefId = auditionId;
        } else {
          const newDocRef = await addDoc(auditionsRef, newAuditionDoc());
          docRefId = newDocRef.id;
        }
      } else {
        const newDocRef = await addDoc(auditionsRef, newAuditionDoc());
        docRefId = newDocRef.id;
      }

      const safeProject = formData.project?.trim();
      const safeRole = formData.role?.trim();
      const queryParams = new URLSearchParams({
        auditionId: docRefId,
        analysisType: mode,
      });
      if (safeProject) queryParams.set("project", safeProject);
      if (safeRole) queryParams.set("role", safeRole);

      router.push(`/acting-coach?${queryParams.toString()}`);
    } catch (error) {
      logger.error({ err: error, msg: 'Error saving audition before going to coach' });
      toast({
        variant: "destructive",
        title: "Couldn't open the coach",
        description: "We couldn't save the audition before opening your coach. Try the Save Output button first, then click Take this to my Coach again.",
      });
    }
  };

  /**
   * Saves the generated character breakdown to Firestore and redirects to the auditions page.
   * Runs deduplication first; if a duplicate exists, opens the AlertDialog and pauses.
   */
  const handleSaveAndFinish = async () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Please log in to save",
        description: "Your auditions are tied to your account — log in and try again.",
      });
      return;
    }
    const userPath = getUserPath();
    if (!userPath) return;
    const auditionsRef = collection(getDb(), `users/${userPath}/auditions`);
    const existingId = await findDuplicateId(auditionsRef);
    if (existingId) {
      setPendingDup({ existingId, nextAction: "save" });
      return;
    }
    await performSave();
  };

  const handleCoachClick = async () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Please log in to open the coach",
        description: "We need to save the audition first, which requires you to be signed in.",
      });
      return;
    }
    const userPath = getUserPath();
    if (!userPath) return;
    const auditionsRef = collection(getDb(), `users/${userPath}/auditions`);
    const existingId = await findDuplicateId(auditionsRef);
    if (existingId) {
      setPendingDup({ existingId, nextAction: "coach" });
      return;
    }
    await performCoach();
  };

  const dupOtherMode: "sides" | "brief" = mode === "sides" ? "brief" : "sides";

  const dupEnrichExisting = () => {
    if (!pendingDup) return;
    const otherMode = dupOtherMode;
    const id = pendingDup.existingId;
    setPendingDup(null);
    router.push(`/auditions/new/${otherMode}?enrichAuditionId=${id}`);
  };

  const dupCreateNew = async () => {
    if (!pendingDup) return;
    const next = pendingDup.nextAction;
    setPendingDup(null);
    if (next === "save") await performSave();
    else await performCoach();
  };


  return (
    <div className="flex flex-col flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-2 h-full">

      {/* Stepper  */}
      {currentStep < 4 && (
        <Stepper currentStep={currentStep} />
      )}

     
      {currentStep === 1 && (
        <div className="flex flex-col flex-1">
          {/* Injecting the context flag to adapt internal copy */}
          <StepBasics data={formData} updateData={updateFormData} mode={mode} isStandaloneScene={isStandaloneScene} />
          
          {/* Next button */}
          <div className="flex justify-end mt-12 mb-8">
            <button 
              type="button"
              onClick={handleNext} 
              className="pointer-events-auto bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-3 rounded-full font-medium transition-colors"
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
            title={mode === "sides" ? "Upload Sides" : "Upload Casting Brief"}
            description={mode === "sides" 
              ? "Upload the script pages (Sides) for this audition." 
              : "Upload the casting brief document, agency email content, character description, or director's notes."}
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
            <button onClick={handleBack} type="button" className="text-[#FF7316] hover:text-[#E66814] font-medium transition-colors px-4 py-2">Back</button>
            <button onClick={handleNext} type="button" className="pointer-events-auto bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-3 rounded-full font-medium transition-colors">Next</button>
          </div>
        </div>
      )}
      
      {/* STEP 3: REVIEW */}
      {currentStep === 3 && (
        <div className="flex flex-col flex-1">
          <StepReview data={formData} mode={mode} />
          
          <div className="flex justify-between items-center mt-12 mb-8">
            <button 
              type="button"
              onClick={handleBack} 
              className="text-[#FF7316] hover:text-[#E66814] font-medium transition-colors px-4 py-2"
            >
              Back to edit
            </button>
            <button
              onClick={() => handleGenerate(false)}
              disabled={!canGenerate}
              title={canGenerate ? undefined : "Fill in project, role, and either upload or paste your content first."}
              className="bg-[#FF7316] hover:bg-[#E66814] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:bg-[#C7C0B5] disabled:hover:bg-[#C7C0B5] disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
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
                <p className="text-[#B7BCB6] text-base">Time to put the kettle on - It takes a couple of minutes</p>
              
              </div>
            </div>
          ) : resultData ? (
            <div className="flex flex-col animate-in fade-in duration-700 max-w-7xl mx-auto w-full">

               {/* --- FIGMA-ALIGNED HEADER --- */}
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 w-full border-b border-[#D0D4D0]/50 pb-6">
                 <div>
                   <h1 className="text-[32px] font-title text-[#2C3328] leading-tight mb-1 uppercase">
                     {formData.role || "character breakdown"}
                   </h1>
                   <p className="text-[#646A64] text-[15px] mb-3 uppercase">
                     {formData.project || "Audition Project"} 
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
                   <button 
                     type="button"
                     onClick={() => handleGenerate(true)}
                     className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#FF7316] text-[#FF7316] text-sm font-medium hover:bg-[#FFF1E8] transition-colors"
                     title="Generate an opposing creative choice"
                   >
                     <RefreshCcw className="w-4 h-4" />
                     Alternative Take
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

               {/* Header metadata band — deadline + casting director, mirrors the detail page */}
               {(localDeadlineStr || formData.castingDirectorName) && (
                 <div className="mb-6 flex flex-wrap items-center gap-3">
                   {localDeadlineStr && (
                     <div className="flex items-center gap-2 rounded-full bg-[#FFF5F0] border border-[#FF7316]/30 px-4 py-2">
                       <CalendarDays className="text-[#FF7316] w-4 h-4 shrink-0" />
                       <span className="text-[10px] font-bold text-[#FF7316] uppercase tracking-widest">Your Local Deadline:</span>
                       <span className="text-[#2C3328] font-semibold text-sm">{localDeadlineStr}</span>
                     </div>
                   )}
                   {formData.castingDirectorName?.trim() && (
                     <div className="flex items-center gap-2 rounded-full bg-white border border-[#C7C0B5] px-4 py-2">
                       <UserIcon className="text-[#6B6B6B] w-4 h-4 shrink-0" />
                       <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest">Casting Director:</span>
                       <span className="text-[#2C3328] font-medium text-sm">{formData.castingDirectorName.trim()}</span>
                     </div>
                   )}
                 </div>
               )}

               {/* --- MAIN UI RENDERER --- */}
               {mode === "sides" ? (
                <StepResultSides data={resultData} onCoachClick={handleCoachClick} onRegenerateClick={() => handleGenerate(true)}/>
              ) : (
                <StepResultBrief data={resultData} localDeadlineStr={localDeadlineStr} onCoachClick={handleCoachClick} />
              )}
               {/* --- HIDDEN PRINT TEMPLATE --- */}
               <div className="hidden">
                 <div ref={printRef} className="bg-white p-12 text-black max-w-[210mm] mx-auto font-title">
                   
                   {/* Header */}
                   <div className="border-b-2 border-black pb-4 mb-8">
                     <h1 className="text-4xl font-bold uppercase text-black">{formData.project || "Audition Project"}</h1>
                     <p className="text-xl text-gray-800 uppercase mt-2">{formData.role || "Character Role"}</p>
                     <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-sans">The Actors Copilot • AI Performance Map</p>
                   </div>

                    <PerformanceMapPrintBlock
                      data={resultData}
                      heading={null}
                      accentColor="black"
                      keyPrefix="wizard"
                    />
                 </div>
               </div>

            </div>
          ) : null}
        </div>
      )}

      {/* Duplicate-audition dialog (replaces window.confirm) */}
      <AlertDialog open={pendingDup !== null} onOpenChange={(open) => { if (!open) setPendingDup(null); }}>
        <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-title text-[#2C3328]">
              You already have a {mode} analysis for this role
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B6B6B] space-y-2">
              <span className="block">
                We found an existing audition for <span className="font-semibold uppercase text-[#2C3328]">&quot;{formData.project}&quot;</span> as <span className="font-semibold uppercase text-[#2C3328]">&quot;{formData.role}&quot;</span> that already has a <span className="font-semibold">{mode}</span> breakdown.
              </span>
              <span className="block">
                The cleanest move is to <span className="font-semibold text-[#2C3328]">enrich the existing audition</span> with this {dupOtherMode === mode ? mode : dupOtherMode} — it keeps everything in one place and your coach will see both maps together.
              </span>
              <span className="block text-xs italic">
                Choose &quot;Create new anyway&quot; only if this is a different take that should live as its own audition.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void dupCreateNew(); }}
              className="bg-[#7A9098] text-white hover:bg-[#6E848B]"
            >
              Create new anyway
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); dupEnrichExisting(); }}
              className="bg-[#FF7316] text-white hover:bg-[#E66814]"
            >
              Enrich existing audition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
