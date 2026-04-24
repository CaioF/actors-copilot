import type { RetrievedExcerpt } from "../contracts";

export interface RetrievalOptions {
  topK?: number;
  namespace?: string;
}

export interface EmbeddingClient {
  embedContent(params: {
    model: string;
    contents: Array<{ parts: Array<{ text: string }> }>;
    config?: {
      outputDimensionality?: number;
      taskType?: string;
    };
  }): Promise<{
    embeddings?: Array<{
      values?: number[];
    }>;
  }>;
}

export interface PineconeIndex {
  query(params: {
    vector: number[];
    topK: number;
    includeMetadata: boolean;
    namespace?: string;
  }): Promise<{
    matches: Array<{
      id: string;
      score?: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}

export interface RetrievalDependencies {
  embeddingClient: EmbeddingClient;
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
  const { embeddingClient, pineconeIndex } = deps;
  const topK = options.topK ?? 5;

  let embeddingResponse;
  try {
    embeddingResponse = await embeddingClient.embedContent({
      model: embeddingModel,
      contents: [{ parts: [{ text: question }] }],
      config: {
        taskType: "RETRIEVAL_QUERY",
      },
    });
  } catch (err) {
    throw new RetrievalError(
      `Embedding failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const vector = embeddingResponse.embeddings?.[0]?.values;
  if (!vector) {
    throw new RetrievalError("Failed to embed question: no embedding returned");
  }

  let queryResponse;
  try {
    queryResponse = await pineconeIndex.query({
      vector,
      topK,
      includeMetadata: true,
      namespace: options.namespace,
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
      excerptText: typeof metadata.content === "string" ? metadata.content : "",
      score: match.score ?? 0,
    };
  });
}
