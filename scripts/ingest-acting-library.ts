#!/usr/bin/env npx ts-node

import { getActingCoachConfig } from "../lib/acting-coach/infrastructure/config";
import { createEmbeddingClient } from "../lib/acting-coach/infrastructure/create-embedding-client";
import { createPineconeClient } from "../lib/acting-coach/infrastructure/create-pinecone-client";
import { loadCorpusDocuments } from "../lib/acting-coach/infrastructure/load-corpus-documents";
import { chunkActingText } from "../lib/acting-coach/domain/chunk-acting-text";
import {
  ingestActingLibrary,
  EmbeddingClient,
  PineconeIndex,
} from "../lib/acting-coach/application/ingest-acting-library";
import type { GoogleGenAI } from "@google/genai";
import type { Index, PineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";

function createEmbeddingClientAdapter(client: GoogleGenAI): EmbeddingClient {
  return {
    embedContent: (params) => {
      return client.models.embedContent(params) as ReturnType<EmbeddingClient["embedContent"]>;
    },
  };
}

function createPineconeIndexAdapter(
  pineconeClient: InstanceType<typeof import("@pinecone-database/pinecone").Pinecone>,
  indexName: string,
  namespace: string
): PineconeIndex {
  let index: Index<RecordMetadata> = pineconeClient.index(indexName);
  if (namespace) {
    index = index.namespace(namespace);
  }
  return {
    upsert: (data: Array<{ id: string; values: number[]; metadata?: Record<string, string | number | boolean | string[]> }>) => {
      return index.upsert(data as PineconeRecord<RecordMetadata>[]) as Promise<unknown>;
    },
    describeIndexStats: () => index.describeIndexStats() as Promise<{ dimension?: number }>,
  };
}

async function main(): Promise<void> {
  console.warn("[ingest-acting-library] Starting acting library ingestion...");

  let config;
  try {
    config = getActingCoachConfig();
    console.warn(`[ingest-acting-library] Config loaded.`);
  } catch (err) {
    console.error("[ingest-acting-library] Failed to load config:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let embeddingClient: EmbeddingClient;
  try {
    const rawClient = createEmbeddingClient();
    embeddingClient = createEmbeddingClientAdapter(rawClient);
    console.warn("[ingest-acting-library] Embedding client created.");
  } catch (err) {
    console.error("[ingest-acting-library] Failed to create embedding client:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let pineconeIndex: PineconeIndex;
  try {
    const pineconeClient = createPineconeClient();
    pineconeIndex = createPineconeIndexAdapter(pineconeClient, config.pineconeIndexName, config.pineconeNamespace);
    console.warn("[ingest-acting-library] Pinecone client created.");
  } catch (err) {
    console.error("[ingest-acting-library] Failed to create Pinecone client:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    const result = await ingestActingLibrary(
      {
        corpusDir: config.corpusDir,
        embeddingModel: config.embeddingModel,
        embeddingDimension: config.embeddingDimension,
        pineconeIndexName: config.pineconeIndexName,
      },
      {
        loadCorpusDocuments,
        chunkActingText,
        embeddingClient,
        pineconeIndex,
      },
      (msg) => console.warn(msg)
    );

    console.warn(`[ingest-acting-library] Ingestion complete. Total chunks ingested: ${result.ingested}`);
    process.exit(0);
  } catch (err) {
    console.error("[ingest-acting-library] Ingestion failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
