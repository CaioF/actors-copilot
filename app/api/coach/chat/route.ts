import { NextResponse } from "next/server";
import { createChildLogger, logger } from "@/lib/logger";
import {
  retrieveCoachContext,
  type PineconeIndex,
} from "@/lib/acting-coach/application/retrieve-coach-context";
import { getUserAuditionsSummary, getAuditionFullData } from "@/lib/acting-coach/application/get-audition-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { createPineconeInferenceClient } from "@/lib/acting-coach/infrastructure/pinecone-inference-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";
import { getActingCoachConfig } from "@/lib/acting-coach/infrastructure/config";
import type { AuditionSummary } from "@/lib/acting-coach/contracts";
import { documentToPromptPart, validateDocumentPayload } from "@/lib/document-processing";

const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // CORREÇÃO 1: Adicionei o currentFocus aqui
    const { content, history, auditionId, document, currentFocus } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (document !== undefined) {
      const validation = validateDocumentPayload(document);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
      }
    }

    const { auth, db } = await import("@/lib/firebase.admin");
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);

    const userRecord = await auth.getUser(decodedToken.uid);
    const firstName = userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
    const userPath = `${decodedToken.uid}_${firstName}`;

    const log = createChildLogger({ route: "coach/chat", userPath });

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();

    let actorBaseline = "";
    if (profileSnap.exists) {
      const profileData = profileSnap.data();
      if (profileData) actorBaseline = JSON.stringify(profileData, null, 2);
    }

    const actorProfileRef = db.doc(`actorProfiles/${decodedToken.uid}`);
    const actorProfileSnap = await actorProfileRef.get();
    let actorProfile = "";
    if (actorProfileSnap.exists) {
      const profileData = actorProfileSnap.data();
      if (profileData) actorProfile = JSON.stringify(profileData, null, 2);
    }

    let auditionSummaries: AuditionSummary[] = [];
    try {
      auditionSummaries = await getUserAuditionsSummary(userPath, db as any);
    } catch (err) {
      log.warn({ err }, "Failed to load audition summaries");
    }

    let auditionFullData: Record<string, unknown> | undefined;
    if (auditionId && typeof auditionId === "string") {
      try {
        const data = await getAuditionFullData(userPath, auditionId, db as any);
        if (data) auditionFullData = data;
      } catch (err) {
        log.warn({ err, auditionId }, "Failed to load audition full data");
      }
    }

    const config = getActingCoachConfig();
    const pineconeInferenceClient = createPineconeInferenceClient({ apiKey: config.pineconeApiKey });
    const pineconeRawIndex = createPineconeClient().index(config.pineconeIndexName);
    const pineconeIndex = (config.pineconeNamespace ? pineconeRawIndex.namespace(config.pineconeNamespace) : pineconeRawIndex) as unknown as PineconeIndex;

    let excerpts;
    try {
      excerpts = await retrieveCoachContext(content, config.embeddingModel, { topK: 5 }, { pineconeInferenceClient, pineconeIndex });
    } catch (err) {
      log.error({ err }, "Retrieval failed");
      return NextResponse.json({ error: "Failed to retrieve context" }, { status: 500 });
    }

    const historyToInclude = (history ?? []).slice(-MAX_HISTORY_MESSAGES);

    const promptText = buildCoachPrompt({
      actorName: firstName,
      actorBaseline,
      actorProfile,
      excerpts,
      question: content,
      history: historyToInclude,
      auditions: auditionSummaries,
      auditionFullData,
      currentFocus: currentFocus ?? null,
    });

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

    let replyText = "";
    try {
      const result = await coachModel.generateContent(promptParts);
      const rawText = result.response.text();

      let parsedResponse;
      try {
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        parsedResponse = JSON.parse(cleanJson);
      } catch (e) {
        parsedResponse = { reply: rawText };
      }

      return NextResponse.json({
        aiData: {
          coach_reply: parsedResponse.reply || parsedResponse.coach_reply || rawText,
          session_focus: parsedResponse.session_focus || currentFocus?.sessionFocus || null,
          step_index: parsedResponse.step_index ?? currentFocus?.stepIndex ?? 0,
          mode: parsedResponse.mode ?? currentFocus?.mode ?? "informational",
          phase: parsedResponse.phase ?? currentFocus?.phase ?? null,
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