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
import type { AttachedDocument } from "@/components/chat-input";

const MAX_HISTORY_MESSAGES = 20;
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Handles conversational Acting Coach chat.
 * Integrates Pinecone vector retrieval for acting methodologies and utilizes
 * Firebase Vertex AI with the global backend to support preview models.
 *
 * @param request - HTTP request containing content, history, auditionId, and optional document payload
 * @returns JSON response with AI coach reply
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, history, auditionId, document } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // --- Document Validation Block ---
    if (document !== undefined) {
      if (!document || typeof document !== "object") {
        return NextResponse.json({ error: "Invalid document format" }, { status: 400 });
      }

      const doc = document as AttachedDocument;

      if (!doc.data || typeof doc.data !== "string") {
        return NextResponse.json({ error: "Document data is required" }, { status: 400 });
      }
      if (!doc.mimeType || typeof doc.mimeType !== "string") {
        return NextResponse.json({ error: "Document mimeType is required" }, { status: 400 });
      }

      const supportedMimes = ["text/plain", "application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!supportedMimes.includes(doc.mimeType)) {
        return NextResponse.json({ error: `Unsupported document type: ${doc.mimeType}` }, { status: 400 });
      }

      const decodedSize = (doc.data.length * 3) / 4;
      if (decodedSize > MAX_DOCUMENT_SIZE_BYTES) {
        return NextResponse.json({ error: "Document exceeds 20MB limit" }, { status: 400 });
      }
    }

    const { auth, db } = await import("@/lib/firebase.admin");
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);

    const userRecord = await auth.getUser(decodedToken.uid);
    const firstName =
      userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") ||
      "Actor";
    const userPath = `${decodedToken.uid}_${firstName}`;

    const log = createChildLogger({ route: "coach/chat", userPath });
    log.trace({ contentLength: content.trim().length }, "Request received");

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();

    let actorBaseline = "";
    if (profileSnap.exists) {
      const summary = profileSnap.data()?.baselineSummary;
      if (summary) {
        actorBaseline = summary;
      }
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
    const pineconeInferenceClient = createPineconeInferenceClient({
      apiKey: config.pineconeApiKey,
    });
    const pineconeRawIndex = createPineconeClient().index(config.pineconeIndexName);
    const pineconeIndex = (config.pineconeNamespace
      ? pineconeRawIndex.namespace(config.pineconeNamespace)
      : pineconeRawIndex) as unknown as PineconeIndex;

    let excerpts;
    try {
      excerpts = await retrieveCoachContext(
        content, // We keep searching Vector DB using only the prompt content
        config.embeddingModel,
        { topK: 5 },
        { pineconeInferenceClient, pineconeIndex }
      );
    } catch (err) {
      log.error({ err }, "Retrieval failed");
      return NextResponse.json(
        { error: "Failed to retrieve context" },
        { status: 500 }
      );
    }

    log.info(
      { excerptCount: excerpts.length, excerpts },
      "Retrieved context from Pinecone"
    );

    const historyToInclude = (history ?? []).slice(-MAX_HISTORY_MESSAGES);

    // Context preparation without inline base64 string manipulation
    const promptText = buildCoachPrompt({
      actorBaseline,
      excerpts,
      question: content,
      history: historyToInclude,
      auditions: auditionSummaries,
      auditionFullData,
    });

    // --- Firebase Vertex AI Initialization (Aligned with DNA route architecture) ---
    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const aiGlobal = getAI(getFirebaseApp(), {
      backend: new VertexAIBackend('global')
    });

    const coachModel = getGenerativeModel(aiGlobal, {
      model: "gemini-3.1-pro-preview",
    });

    type PromptPart = { text: string } | { inlineData: { data: string; mimeType: string } };

    const promptParts: PromptPart[] = [
      { text: promptText }
    ];

    // Native attachment handling via Vertex AI SDK
    if (document && document.data && document.mimeType) {
      promptParts.push({
        inlineData: {
          data: document.data,
          mimeType: document.mimeType,
        },
      });
    }

    let replyText: string;
    try {
      const result = await coachModel.generateContent(promptParts);
      replyText = result.response.text();
    } catch (err) {
      log.error({ err }, "Generation failed");
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        aiData: {
          coach_reply: replyText,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error, msg: "Coach Chat API Error" });
    return NextResponse.json(
      { error: "Failed to generate chat response" },
      { status: 500 }
    );
  }
}