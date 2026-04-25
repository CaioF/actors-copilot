import { NextResponse } from "next/server";
import { createChildLogger, logger } from "@/lib/logger";
import {
  retrieveCoachContext,
  type EmbeddingClient,
  type PineconeIndex,
} from "@/lib/acting-coach/application/retrieve-coach-context";
import { getUserAuditionsSummary } from "@/lib/acting-coach/application/get-audition-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { createGenerationModel } from "@/lib/acting-coach/infrastructure/create-generation-model";
import { createEmbeddingClient } from "@/lib/acting-coach/infrastructure/create-embedding-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";
import { getActingCoachConfig } from "@/lib/acting-coach/infrastructure/config";
import type { CoachCitation, AuditionSummary } from "@/lib/acting-coach/contracts";

function createEmbeddingClientAdapter(
  client: ReturnType<typeof createEmbeddingClient>
): EmbeddingClient {
  return {
    embedContent: (params) => client.models.embedContent(params),
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, history } = body;

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

    const config = getActingCoachConfig();
    const embeddingClient = createEmbeddingClientAdapter(createEmbeddingClient());
    const pineconeIndex = createPineconeClient()
      .index(config.pineconeIndexName)
      .namespace(config.pineconeNamespace || undefined) as PineconeIndex;

    let excerpts;
    try {
      excerpts = await retrieveCoachContext(
        content,
        config.embeddingModel,
        { topK: 5, namespace: config.pineconeNamespace || undefined },
        { embeddingClient, pineconeIndex }
      );
    } catch (err) {
      log.error({ err }, "Retrieval failed");
      return NextResponse.json(
        { error: "Failed to retrieve context" },
        { status: 500 }
      );
    }

    const prompt = buildCoachPrompt({
      actorBaseline,
      excerpts,
      question: content,
      history,
      auditions: auditionSummaries,
    });

    let generationModel;
    try {
      generationModel = createGenerationModel();
    } catch (err) {
      log.error({ err }, "Failed to create generation model");
      return NextResponse.json(
        { error: "Failed to initialize generation model" },
        { status: 500 }
      );
    }

    let replyText: string;
    try {
      const result = await generationModel.generateContent(prompt);
      replyText = result.response.text();
    } catch (err) {
      log.error({ err }, "Generation failed");
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    const citations: CoachCitation[] = excerpts.map((excerpt) => ({
      citationNumber: excerpt.citationNumber,
      sourceBook: excerpt.sourceBook,
      excerptText: excerpt.excerptText,
    }));

    return NextResponse.json(
      {
        aiData: {
          coach_reply: replyText,
          citations,
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
