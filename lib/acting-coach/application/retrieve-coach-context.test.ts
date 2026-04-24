import { retrieveCoachContext, RetrievalError } from "./retrieve-coach-context";

describe("retrieveCoachContext", () => {
  const mockEmbedContent = jest.fn();
  const mockQuery = jest.fn();

  const mockEmbeddingClient = {
    embedContent: mockEmbedContent,
  };

  const mockPineconeIndex = {
    query: mockQuery,
  };

  const defaultDeps = {
    embeddingClient: mockEmbeddingClient,
    pineconeIndex: mockPineconeIndex,
  };

  const defaultOptions = {
    topK: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("embedding and query orchestration", () => {
    it("calls embedding client with retrieval-query task type", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "text-embedding-004",
        contents: [{ parts: [{ text: "How do I prepare for an audition?" }] }],
        config: { taskType: "RETRIEVAL_QUERY" },
      });
    });

    it("forwards the resulting embedding vector to Pinecone query", async () => {
      const embeddingVector = new Array(768).fill(0.1);
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: embeddingVector }],
      });
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(mockQuery).toHaveBeenCalledWith({
        vector: embeddingVector,
        topK: 5,
        includeMetadata: true,
        namespace: undefined,
      });
    });

    it("uses custom topK and namespace when provided", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        { topK: 10, namespace: "test-namespace" },
        defaultDeps
      );

      expect(mockQuery).toHaveBeenCalledWith({
        vector: expect.any(Array),
        topK: 10,
        includeMetadata: true,
        namespace: "test-namespace",
      });
    });
  });

  describe("result mapping", () => {
    it("maps Pinecone matches to RetrievedExcerpt with citation numbers, sourceBook, excerptText, and score", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "acting-guide.txt#0",
            score: 0.95,
            metadata: {
              sourceBook: "acting-guide.txt",
              content: "First paragraph about acting.",
              chunkIndex: 0,
              contentType: "text/plain",
            },
          },
          {
            id: "acting-guide.txt#1",
            score: 0.87,
            metadata: {
              sourceBook: "acting-guide.txt",
              content: "Second paragraph about auditioning.",
              chunkIndex: 1,
              contentType: "text/plain",
            },
          },
        ],
      });

      const result = await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        citationNumber: 1,
        sourceBook: "acting-guide.txt",
        excerptText: "First paragraph about acting.",
        score: 0.95,
      });

      expect(result[1]).toEqual({
        citationNumber: 2,
        sourceBook: "acting-guide.txt",
        excerptText: "Second paragraph about auditioning.",
        score: 0.87,
      });
    });

    it("uses id as sourceBook fallback when metadata.sourceBook is missing", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "acting-guide.txt#0",
            score: 0.95,
            metadata: {
              content: "Some content.",
            },
          },
        ],
      });

      const result = await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].sourceBook).toBe("acting-guide.txt#0");
    });

    it("defaults score to 0 when not provided", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "acting-guide.txt#0",
            metadata: {
              sourceBook: "acting-guide.txt",
              content: "Some content.",
            },
          },
        ],
      });

      const result = await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].score).toBe(0);
    });

    it("defaults excerptText to empty string when content is missing from metadata", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "acting-guide.txt#0",
            score: 0.95,
            metadata: {
              sourceBook: "acting-guide.txt",
            },
          },
        ],
      });

      const result = await retrieveCoachContext(
        "How do I prepare for an audition?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].excerptText).toBe("");
    });
  });

  describe("empty result handling", () => {
    it("returns empty array when Pinecone returns no matches", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({ matches: [] });

      const result = await retrieveCoachContext(
        "Unanswerable question?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result).toEqual([]);
    });

    it("returns empty array when matches is undefined", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockResolvedValue({});

      const result = await retrieveCoachContext(
        "Unanswerable question?",
        "text-embedding-004",
        defaultOptions,
        defaultDeps
      );

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("throws RetrievalError when embedding fails to return a vector", async () => {
      mockEmbedContent.mockResolvedValue({ embeddings: [] });

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Failed to embed question: no embedding returned");
    });

    it("throws RetrievalError when embedding client throws", async () => {
      mockEmbedContent.mockRejectedValue(new Error("Embedding API quota exceeded"));

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Embedding failed");
    });

    it("throws RetrievalError when Pinecone query fails", async () => {
      mockEmbedContent.mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      });
      mockQuery.mockRejectedValue(new Error("Pinecone connection refused"));

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "text-embedding-004",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Pinecone query failed");
    });
  });
});
