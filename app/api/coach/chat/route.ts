import { NextResponse } from "next/server";
import { createChildLogger, logger } from "@/lib/logger";
import {
  retrieveCoachContext,
  type PineconeIndex,
} from "@/lib/acting-coach/application/retrieve-coach-context";
import { getUserAuditionsSummary, getAuditionFullData } from "@/lib/acting-coach/application/get-audition-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { createGenerationModel } from "@/lib/acting-coach/infrastructure/create-generation-model";
import { createPineconeInferenceClient } from "@/lib/acting-coach/infrastructure/pinecone-inference-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";
import { getActingCoachConfig } from "@/lib/acting-coach/infrastructure/config";
import { COACH_REPLY_SCHEMA } from "@/lib/acting-coach/infrastructure/coach-reply-schema";
import type { AuditionSummary, CoachReplyEnvelope } from "@/lib/acting-coach/contracts";
import { runCoachTriggeredExtraction } from "@/lib/dna/extraction/run-extraction";
import type { ExtractedPsychData, ChatHistoryMessage } from "@/lib/chat-types";

const MAX_HISTORY_MESSAGES = 20;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, history, auditionId, currentFocus } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
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
        content,
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

    const prompt = buildCoachPrompt({
      actorBaseline,
      excerpts,
      question: content,
      history: historyToInclude,
      auditions: auditionSummaries,
      auditionFullData,
      currentFocus: currentFocus ?? null,
    });

    let generationModel;
    try {
      generationModel = createGenerationModel({
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: COACH_REPLY_SCHEMA,
        },
      });
    } catch (err) {
      log.error({ err }, "Failed to create generation model");
      return NextResponse.json(
        { error: "Failed to initialize generation model" },
        { status: 500 }
      );
    }

    let envelope: CoachReplyEnvelope;
    try {
      const result = await generationModel.generateContent(prompt);
      const rawText = result.response.text();
      try {
        const parsed = JSON.parse(rawText);
        if (
          typeof parsed.reply !== "string" ||
          !Number.isInteger(parsed.step_index) ||
          !["guided", "informational", "transition"].includes(parsed.mode)
        ) {
          throw new Error("envelope shape invalid");
        }
        if (parsed.action !== undefined && parsed.action !== null) {
          if (
            typeof parsed.action !== "object" ||
            Array.isArray(parsed.action) ||
            typeof parsed.action.type !== "string"
          ) {
            throw new Error("envelope shape invalid");
          }
        }
        envelope = {
          reply: parsed.reply,
          session_focus: typeof parsed.session_focus === "string" ? parsed.session_focus : null,
          step_index: parsed.step_index,
          mode: parsed.mode,
          phase: typeof parsed.phase === "string" ? parsed.phase : null,
          action: parsed.action != null ? parsed.action : null,
        };
      } catch (parseErr) {
        log.warn({ err: parseErr, rawText }, "Coach envelope parse failed; using raw text fallback");
        envelope = {
          reply: rawText,
          session_focus: null,
          step_index: 0,
          mode: "informational",
          phase: null,
          action: null,
        };
      }

      let extractions: ExtractedPsychData | null = null;
      if (envelope.action?.type === "trigger_dna_extraction") {
        log.debug({ historyCount: (body.history ?? []).length }, "Coach emitted trigger_dna_extraction, running extraction");
        try {
          const historyMessages: ChatHistoryMessage[] = (body.history ?? []).map(
            (msg: { role: string; content: string }) => ({
              role: msg.role === "assistant" ? "model" : msg.role,
              parts: [{ text: msg.content }],
            })
          );
          extractions = await runCoachTriggeredExtraction({
            content: body.content.trim(),
            history: historyMessages.slice(-20),
          });
          log.info({
            hasExtraction: extractions !== null,
            depthScore: extractions?.progress_assessment?.depth_score,
            hasActionablePattern: extractions?.progress_assessment?.has_actionable_pattern,
            newTraitsCount: extractions?.new_traits?.length ?? 0,
            defenseMechCount: extractions?.defense_mechanisms?.length ?? 0,
            snippetCount: extractions?.leaf_snippets?.length ?? 0,
          }, "Coach extraction completed");
        } catch (extractErr) {
          log.error({ err: extractErr }, "Coach extraction failed");
          extractions = null;
        }
      }

      return NextResponse.json(
        {
          aiData: {
            coach_reply: envelope.reply,
            session_focus: envelope.session_focus,
            step_index: envelope.step_index,
            mode: envelope.mode,
            phase: envelope.phase,
            action: envelope.action,
            extractions: extractions ?? undefined,
          },
        },
        { status: 200 }
      );
    } catch (err) {
      log.error({ err }, "Generation failed");
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error({ err: error, msg: "Coach Chat API Error" });
    return NextResponse.json(
      { error: "Failed to generate chat response" },
      { status: 500 }
    );
  }
}
