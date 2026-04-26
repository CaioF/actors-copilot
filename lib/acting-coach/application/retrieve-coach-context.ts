import type { RetrievedExcerpt } from "../contracts";
import type { PineconeInferenceClient } from "../infrastructure/pinecone-inference-client";

export type { PineconeInferenceClient };

export interface RetrievalOptions {
  topK?: number;
  namespace?: string;
}

export interface PineconeIndex {
  query(params: {
    vector: number[];
    topK: number;
    includeMetadata: boolean;
  }): Promise<{
    matches: Array<{
      id: string;
      score?: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}

export interface RetrievalDependencies {
  pineconeInferenceClient: PineconeInferenceClient;
  pineconeIndex: PineconeIndex;
}

export class RetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalError";
  }
}

export async function retrieveCoachContext(
  question: string,
  embeddingModel: string,
  options: RetrievalOptions,
  deps: RetrievalDependencies
): Promise<RetrievedExcerpt[]> {
  const { pineconeInferenceClient, pineconeIndex } = deps;
  const topK = options.topK ?? 5;

  let embeddingResult: number[][];
  try {
    embeddingResult = await pineconeInferenceClient.embed({
      model: embeddingModel,
      inputs: [question],
      taskType: "RETRIEVAL_QUERY",
    });
  } catch (err) {
    throw new RetrievalError(
      `Embedding failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const vector = embeddingResult[0];
  if (!vector || vector.length === 0) {
    throw new RetrievalError("Failed to embed question: no embedding returned");
  }

  let queryResponse;
  try {
    queryResponse = await pineconeIndex.query({
      vector,
      topK,
      includeMetadata: true,
    });
  } catch (err) {
    throw new RetrievalError(
      `Pinecone query failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const matches = queryResponse.matches ?? [];

  return matches.map((match, index) => {
    const metadata = match.metadata ?? {};
    return {
      citationNumber: index + 1,
      sourceBook: typeof metadata.sourceBook === "string" ? metadata.sourceBook : match.id,
      excerptText: typeof metadata.text === "string" ? metadata.text : "",
      score: match.score ?? 0,
    };
  });
}
