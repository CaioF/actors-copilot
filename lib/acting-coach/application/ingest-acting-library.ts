import type { ActingLibraryDocument } from "../domain/acting-library-types";
import type { ActingLibraryChunk } from "../domain/acting-library-types";
import type { ChunkOptions } from "../domain/acting-library-types";
import type { ChunkMetadata } from "../domain/acting-library-types";

export interface IngestOptions {
  corpusDir: string;
  embeddingModel: string;
  embeddingDimension: number;
  pineconeIndexName: string;
  chunkSize?: number;
  overlapSize?: number;
}

export interface CorpusLoader {
  (corpusDir: string): Promise<ActingLibraryDocument[]>;
}

export interface Chunker {
  (
    document: ActingLibraryDocument,
    options?: Partial<ChunkOptions>
  ): ActingLibraryChunk[];
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
  upsert(data: Array<{
    id: string;
    values: number[];
    metadata?: Record<string, string | number | boolean | string[]>;
  }>): Promise<unknown>;
  describeIndexStats(): Promise<{
    dimension?: number;
  }>;
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

export interface IngestDependencies {
  loadCorpusDocuments: CorpusLoader;
  chunkActingText: Chunker;
  embeddingClient: EmbeddingClient;
  pineconeIndex: PineconeIndex;
}

function deriveChunkId(sourceBook: string, chunkIndex: number): string {
  return `${sourceBook}#${chunkIndex}`;
}

export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

export class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreflightError";
  }
}

export async function ingestActingLibrary(
  options: IngestOptions,
  deps: IngestDependencies,
  onProgress?: (msg: string) => void
): Promise<{ ingested: number }> {
  const {
    corpusDir,
    embeddingModel,
    embeddingDimension,
    pineconeIndexName,
    chunkSize,
    overlapSize,
  } = options;

  const { loadCorpusDocuments, chunkActingText, embeddingClient, pineconeIndex } = deps;

  const progress = (msg: string) => {
    if (onProgress) {
      onProgress(msg);
    }
  };

  progress(`[preflight] Checking corpus directory: ${corpusDir}`);
  try {
    const documents = await loadCorpusDocuments(corpusDir);
    if (documents.length === 0) {
      throw new IngestionError(`No documents found in corpus directory: ${corpusDir}`);
    }
    progress(`[preflight] Found ${documents.length} document(s) in corpus`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("does not exist")) {
      throw new PreflightError(`Corpus directory does not exist: ${corpusDir}`);
    }
    throw err;
  }

  progress(`[preflight] Checking Pinecone index: ${pineconeIndexName}`);
  let actualDimension: number | undefined;
  try {
    const stats = await pineconeIndex.describeIndexStats();
    actualDimension = stats.dimension;
    if (actualDimension === undefined) {
      throw new PreflightError(
        `Could not determine dimension of Pinecone index: ${pineconeIndexName}`
      );
    }
    if (actualDimension !== embeddingDimension) {
      throw new PreflightError(
        `Embedding dimension mismatch: configured ${embeddingDimension} but Pinecone index has dimension ${actualDimension}`
      );
    }
    progress(`[preflight] Pinecone index dimension OK: ${actualDimension}`);
  } catch (err) {
    if (err instanceof PreflightError) {
      throw err;
    }
    throw new PreflightError(
      `Cannot reach Pinecone index '${pineconeIndexName}': ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const documents = await loadCorpusDocuments(corpusDir);
  let totalIngested = 0;

  for (const document of documents) {
    progress(`[ingest] Processing: ${document.sourceBook}`);

    const chunks = chunkActingText(document, { chunkSize, overlapSize });
    if (chunks.length === 0) {
      progress(`[ingest] No chunks produced for ${document.sourceBook}, skipping`);
      continue;
    }

    progress(`[ingest] ${document.sourceBook}: ${chunks.length} chunk(s) to embed`);

    for (const chunk of chunks) {
      const chunkId = deriveChunkId(document.sourceBook, chunk.metadata.chunkIndex);

      const embeddingResponse = await embeddingClient.embedContent({
        model: embeddingModel,
        contents: [{ parts: [{ text: chunk.content }] }],
        config: {
          outputDimensionality: embeddingDimension,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      });

      const embedding = embeddingResponse.embeddings?.[0]?.values;
      if (!embedding) {
        throw new IngestionError(
          `Failed to embed chunk ${chunkId} of ${document.sourceBook}: no embedding returned`
        );
      }

      if (embedding.length !== embeddingDimension) {
        throw new IngestionError(
          `Embedding dimension mismatch for chunk ${chunkId}: expected ${embeddingDimension}, got ${embedding.length}`
        );
      }

      const pineconeRecord = {
        id: chunkId,
        values: embedding,
        metadata: {
          sourceBook: chunk.metadata.sourceBook,
          chunkIndex: chunk.metadata.chunkIndex,
          contentType: chunk.metadata.contentType,
          isTruncated: chunk.metadata.isTruncated ?? false,
          content: chunk.content,
        },
      };

      await pineconeIndex.upsert([pineconeRecord]);
      totalIngested++;
    }

    progress(`[ingest] Ingested ${chunks.length} chunk(s) from ${document.sourceBook}`);
  }

  progress(`[done] Total chunks ingested: ${totalIngested}`);
  return { ingested: totalIngested };
}
