import { ingestActingLibrary, IngestionError, PreflightError } from "./ingest-acting-library";
import type { ActingLibraryDocument, ActingLibraryChunk } from "../domain/acting-library-types";

describe("ingestActingLibrary", () => {
  const mockLoadCorpusDocuments = jest.fn();
  const mockChunkActingText = jest.fn();
  const mockEmbedContent = jest.fn();
  const mockDescribeIndexStats = jest.fn();
  const mockUpsert = jest.fn();

  const mockEmbeddingClient = {
    embedContent: mockEmbedContent,
  };

  const mockPineconeIndex = {
    upsert: mockUpsert,
    describeIndexStats: mockDescribeIndexStats,
  };

  const defaultOptions = {
    corpusDir: "/fake/corpus",
    embeddingModel: "text-embedding-004",
    embeddingDimension: 768,
    pineconeIndexName: "acting-coach-index",
  };

  const defaultDeps = {
    loadCorpusDocuments: mockLoadCorpusDocuments,
    chunkActingText: mockChunkActingText,
    embeddingClient: mockEmbeddingClient,
    pineconeIndex: mockPineconeIndex,
  };

  const sampleDocuments: ActingLibraryDocument[] = [
    {
      sourceBook: "acting-guide.txt",
      content: "First paragraph.\n\nSecond paragraph.",
      contentType: "text/plain",
    },
  ];

  const sampleChunks: ActingLibraryChunk[] = [
    {
      content: "First paragraph.",
      metadata: {
        sourceBook: "acting-guide.txt",
        chunkIndex: 0,
        contentType: "text/plain",
        isTruncated: false,
      },
    },
    {
      content: "Second paragraph.",
      metadata: {
        sourceBook: "acting-guide.txt",
        chunkIndex: 1,
        contentType: "text/plain",
        isTruncated: false,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDescribeIndexStats.mockResolvedValue({ dimension: 768 });
    mockUpsert.mockResolvedValue(undefined);
  });

  describe("full pipeline execution", () => {
    it("loads documents, chunks them, calls embedding client per chunk, and upserts vectors", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      const result = await ingestActingLibrary(defaultOptions, defaultDeps);

      expect(mockLoadCorpusDocuments).toHaveBeenCalledWith("/fake/corpus");
      expect(mockChunkActingText).toHaveBeenCalledTimes(1);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(result.ingested).toBe(2);
    });

    it("calls embedding client with correct model and outputDimensionality", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      await ingestActingLibrary(defaultOptions, defaultDeps);

      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "text-embedding-004",
        contents: [{ parts: [{ text: "First paragraph." }] }],
        config: { outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" },
      });
    });

    it("upserts with deterministic chunk IDs derived from source path and chunk index", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      await ingestActingLibrary(defaultOptions, defaultDeps);

      const upsertCalls = mockUpsert.mock.calls;
      expect(upsertCalls[0][0][0].id).toBe("acting-guide.txt#0");
      expect(upsertCalls[1][0][0].id).toBe("acting-guide.txt#1");
    });

    it("includes correct metadata in upserted records", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      await ingestActingLibrary(defaultOptions, defaultDeps);

      const upsertRecord = mockUpsert.mock.calls[0][0][0];
      expect(upsertRecord.metadata).toEqual({
        sourceBook: "acting-guide.txt",
        chunkIndex: 0,
        contentType: "text/plain",
        isTruncated: false,
        content: "First paragraph.",
      });
    });
  });

  describe("failure handling", () => {
    it("aborts with descriptive error when a document fails to load", async () => {
      mockLoadCorpusDocuments.mockRejectedValue(new Error("Disk read error"));

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Disk read error"
      );
    });

    it("aborts with descriptive error when embedding fails for a chunk", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockRejectedValue(new Error("Embedding API rate limit"));

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Embedding API rate limit"
      );
    });

    it("throws IngestionError when no embedding is returned for a chunk", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({ embeddings: [] });

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Failed to embed chunk acting-guide.txt#0"
      );
    });

    it("throws IngestionError when embedding dimension does not match configured dimension", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(384).fill(0.1) }],
      });

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Embedding dimension mismatch"
      );
    });

    it("throws IngestionError when Pinecone upsert fails", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockUpsert.mockRejectedValue(new Error("Pinecone network error"));

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Pinecone network error"
      );
    });
  });

  describe("idempotency", () => {
    it("produces deterministic chunk IDs so repeated runs overwrite the same records", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      await ingestActingLibrary(defaultOptions, defaultDeps);
      await ingestActingLibrary(defaultOptions, defaultDeps);

      expect(mockUpsert).toHaveBeenCalledTimes(4);
      const firstRunIds = mockUpsert.mock.calls.slice(0, 2).map((c) => c[0][0].id);
      const secondRunIds = mockUpsert.mock.calls.slice(2, 4).map((c) => c[0][0].id);
      expect(firstRunIds).toEqual(secondRunIds);
    });
  });

  describe("preflight checks", () => {
    it("throws PreflightError when corpus directory does not exist", async () => {
      mockLoadCorpusDocuments.mockRejectedValue(
        new Error("Corpus directory does not exist: /fake/corpus")
      );

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        PreflightError
      );
      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Corpus directory does not exist"
      );
    });

    it("throws PreflightError when Pinecone index cannot be reached", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockDescribeIndexStats.mockRejectedValue(new Error("Connection refused"));

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        PreflightError
      );
      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Cannot reach Pinecone index"
      );
    });

    it("throws PreflightError when Pinecone index dimension does not match configured embedding dimension", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockDescribeIndexStats.mockResolvedValue({ dimension: 384 });

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        PreflightError
      );
      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "Embedding dimension mismatch"
      );
    });

    it("throws IngestionError when corpus directory has no documents", async () => {
      mockLoadCorpusDocuments.mockResolvedValue([]);

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        IngestionError
      );
      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow(
        "No documents found"
      );
    });

    it("does not call embedding or upsert when preflight fails", async () => {
      mockLoadCorpusDocuments.mockRejectedValue(
        new Error("Corpus directory does not exist: /fake/corpus")
      );

      await expect(ingestActingLibrary(defaultOptions, defaultDeps)).rejects.toThrow();
      expect(mockChunkActingText).not.toHaveBeenCalled();
      expect(mockEmbedContent).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("empty corpus handling", () => {
    it("skips documents that produce no chunks", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue([]);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      const result = await ingestActingLibrary(defaultOptions, defaultDeps);

      expect(result.ingested).toBe(0);
      expect(mockEmbedContent).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("progress callbacks", () => {
    it("calls onProgress with preflight and ingestion messages", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue(sampleChunks);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });

      const progressMessages: string[] = [];
      const onProgress = (msg: string) => progressMessages.push(msg);

      await ingestActingLibrary(defaultOptions, defaultDeps, onProgress);

      expect(progressMessages.some((m) => m.includes("[preflight]"))).toBe(true);
      expect(progressMessages.some((m) => m.includes("[ingest]"))).toBe(true);
      expect(progressMessages.some((m) => m.includes("[done]"))).toBe(true);
    });
  });

  describe("chunk options passthrough", () => {
    it("passes chunkSize and overlapSize to the chunker", async () => {
      mockLoadCorpusDocuments.mockResolvedValue(sampleDocuments);
      mockChunkActingText.mockReturnValue([]);

      await ingestActingLibrary(
        { ...defaultOptions, chunkSize: 500, overlapSize: 50 },
        defaultDeps
      );

      expect(mockChunkActingText).toHaveBeenCalledWith(sampleDocuments[0], {
        chunkSize: 500,
        overlapSize: 50,
      });
    });
  });
});
