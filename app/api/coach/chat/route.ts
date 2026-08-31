import { NextResponse } from "next/server";
import { createChildLogger, logger } from "@/lib/logger";
import { getUserAuditionsSummary, getAuditionFullData } from "@/lib/acting-coach/application/get-audition-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import type { AuditionSummary } from "@/lib/acting-coach/contracts";
import { documentToPromptPart, validateDocumentPayload } from "@/lib/document-processing";

const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: Request) {
  const t0 = performance.now();
  console.log(`[PERF][SERVER] 🚀 POST /api/coach/chat request received at t=0ms`);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log(`[PERF][SERVER] ❌ Unauthorized request after ${(performance.now() - t0).toFixed(1)}ms`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, history, auditionId, document, currentFocus, coachType, targetStage: rawTargetStage } = body;
    const targetStage = Number.isInteger(rawTargetStage) && rawTargetStage >= 1 && rawTargetStage <= 10
      ? (rawTargetStage as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : undefined;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (document !== undefined) {
      const validation = validateDocumentPayload(document);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
      }
    }

    const tAuthStart = performance.now();
    const { auth, db, verifyOrDecodeIdToken } = await import("@/lib/firebase.admin");
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = typeof verifyOrDecodeIdToken === "function"
      ? await verifyOrDecodeIdToken(token)
      : await auth.verifyIdToken(token);

    let rawFirstName = (decodedToken as { name?: string }).name?.split(" ")[0];
    if (!rawFirstName && auth.getUser) {
      try {
        const userRecord = await auth.getUser(decodedToken.uid);
        if (userRecord?.displayName) {
          rawFirstName = userRecord.displayName.split(" ")[0];
        }
      } catch {
        // Fallback
      }
    }
    const firstName = (rawFirstName || "Actor").replace(/[^a-zA-Z0-9]/g, "") || "Actor";
    const userPath = `${decodedToken.uid}_${firstName}`;
    console.log(`[PERF][SERVER] ⏱️ Auth verification completed in ${(performance.now() - tAuthStart).toFixed(1)}ms`);

    const log = createChildLogger({ route: "coach/chat", userPath });

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const actorProfileRef = db.doc(`actorProfiles/${decodedToken.uid}`);

    // Parallelize all context reads (profile, public profile, audition summaries, full audition data)
    const tContextStart = performance.now();
    const [profileSnapResult, actorProfileSnapResult, auditionSummariesResult, auditionFullDataResult] = await Promise.allSettled([
      profileRef.get(),
      actorProfileRef.get(),
      getUserAuditionsSummary(userPath, db as any),
      auditionId && typeof auditionId === "string" 
        ? getAuditionFullData(userPath, auditionId, db as any)
        : Promise.resolve(undefined)
    ]);
    console.log(`[PERF][SERVER] ⏱️ Parallel context reads completed in ${(performance.now() - tContextStart).toFixed(1)}ms`);

    let actorBaseline = "";
    if (profileSnapResult.status === "fulfilled" && profileSnapResult.value.exists) {
      const profileData = profileSnapResult.value.data();
      if (profileData) actorBaseline = JSON.stringify(profileData, null, 2);
    }

    let actorProfile = "";
    if (actorProfileSnapResult.status === "fulfilled" && actorProfileSnapResult.value.exists) {
      const profileData = actorProfileSnapResult.value.data();
      if (profileData) actorProfile = JSON.stringify(profileData, null, 2);
    }

    let auditionSummaries: AuditionSummary[] = [];
    if (auditionSummariesResult.status === "fulfilled" && auditionSummariesResult.value) {
      auditionSummaries = auditionSummariesResult.value;
    } else if (auditionSummariesResult.status === "rejected") {
      log.warn({ err: auditionSummariesResult.reason }, "Failed to load audition summaries");
    }

    let auditionFullData: Record<string, unknown> | undefined;
    if (auditionFullDataResult.status === "fulfilled" && auditionFullDataResult.value) {
      auditionFullData = auditionFullDataResult.value;
    } else if (auditionFullDataResult.status === "rejected") {
      log.warn({ err: auditionFullDataResult.reason, auditionId }, "Failed to load audition full data");
    }

    const historyToInclude = (history ?? []).slice(-MAX_HISTORY_MESSAGES);

    const mergedFocus = currentFocus ? {
      ...currentFocus,
      ...(targetStage ? { currentStage: targetStage } : {}),
    } : (targetStage ? {
      sessionFocus: `Stage ${targetStage}`,
      stepIndex: 0,
      mode: "guided" as const,
      phase: null,
      currentStage: targetStage,
      completedStages: [],
      flightPlanMode: "guided" as const,
    } : null);

    const resolvedCoachType = coachType || (auditionId ? "character" : "general");

    const promptText = buildCoachPrompt({
      coachType: resolvedCoachType,
      actorName: firstName,
      actorBaseline,
      actorProfile,
      excerpts: [],
      question: content,
      history: historyToInclude,
      auditions: auditionSummaries,
      auditionFullData,
      currentFocus: mergedFocus,
    });

    const tModelInitStart = performance.now();
    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const aiGlobal = getAI(getFirebaseApp(), { backend: new VertexAIBackend('global') });
    const coachModel = getGenerativeModel(aiGlobal, { model: "gemini-3.1-pro-preview" });

    const promptParts: any[] = [{ text: promptText }];
    if (document?.data && document?.mimeType) {
      const docPart = await documentToPromptPart(document);
      if (!docPart.ok) {
        log.error({ mimeType: document.mimeType }, "Document processing failed");
        return NextResponse.json({ error: docPart.error }, { status: docPart.status });
      }
      promptParts.push(docPart.part);
    }

    console.log(`[PERF][SERVER] ⏱️ AI Model & Prompt prepared in ${(performance.now() - tModelInitStart).toFixed(1)}ms. Invoking coachModel generateContent...`);

    try {
      const tCoachStart = performance.now();
      const result = await coachModel.generateContent(promptParts);
      const rawText = result.response.text();
      console.log(`[PERF][SERVER] ⏱️ Coach model generation completed in ${(performance.now() - tCoachStart).toFixed(1)}ms (Output length: ${rawText.length} chars)`);

      let parsedResponse;
      try {
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        parsedResponse = JSON.parse(cleanJson);
      } catch {
        parsedResponse = { reply: rawText };
      }

      return NextResponse.json({
        aiData: {
          coach_reply: parsedResponse.reply || parsedResponse.coach_reply || rawText,
          session_focus: parsedResponse.session_focus || currentFocus?.sessionFocus || null,
          step_index: parsedResponse.step_index ?? currentFocus?.stepIndex ?? 0,
          mode: parsedResponse.mode ?? currentFocus?.mode ?? "informational",
          phase: parsedResponse.phase ?? currentFocus?.phase ?? null,
          current_stage: parsedResponse.current_stage ?? targetStage ?? currentFocus?.currentStage ?? (auditionId ? 1 : null),
          completed_stages: parsedResponse.completed_stages ?? currentFocus?.completedStages ?? [],
          flight_plan_mode: parsedResponse.flight_plan_mode ?? currentFocus?.flightPlanMode ?? "guided",
          sides_text: typeof auditionFullData?.sidesText === "string" ? auditionFullData.sidesText : null,
          audition_plan: parsedResponse.audition_plan || null,
          action: parsedResponse.action || null,
          extractions: parsedResponse.extractions || null
        }
      });

    } catch (err) {
      log.error({ err }, "Generation failed");
      return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }

  } catch (error) {
    logger.error({ err: error, msg: "Coach Chat API Error" });
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
  }
}
