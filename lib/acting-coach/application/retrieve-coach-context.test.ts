import { retrieveCoachContext, RetrievalError } from "./retrieve-coach-context";

describe("retrieveCoachContext", () => {
  const mockEmbed = jest.fn();
  const mockQuery = jest.fn();

  const mockPineconeInferenceClient = {
    embed: mockEmbed,
  };

  const mockPineconeIndex = {
    query: mockQuery,
  };

  const defaultDeps = {
    pineconeInferenceClient: mockPineconeInferenceClient,
    pineconeIndex: mockPineconeIndex,
  };

  const defaultOptions = {
    topK: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("embedding and query orchestration", () => {
    it("calls Pinecone inference client with retrieval-query task type", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(mockEmbed).toHaveBeenCalledWith({
        model: "llama-text-embed-v2",
        inputs: ["How do I prepare for an audition?"],
        taskType: "RETRIEVAL_QUERY",
      });
    });

    it("forwards the resulting embedding vector to Pinecone query", async () => {
      const embeddingVector = new Array(768).fill(0.1);
      mockEmbed.mockResolvedValue([embeddingVector]);
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(mockQuery).toHaveBeenCalledWith({
        vector: embeddingVector,
        topK: 5,
        includeMetadata: true,
      });
    });

    it("uses custom topK when provided", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockResolvedValue({ matches: [] });

      await retrieveCoachContext(
        "How do I prepare for an audition?",
        "llama-text-embed-v2",
        { topK: 10 },
        defaultDeps
      );

      expect(mockQuery).toHaveBeenCalledWith({
        vector: expect.any(Array),
        topK: 10,
        includeMetadata: true,
      });
    });
  });

  describe("result mapping", () => {
    it("maps Pinecone matches to RetrievedExcerpt with citation numbers, sourceBook, excerptText, and score", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "acting-guide.txt#0",
            score: 0.95,
            metadata: {
              sourceBook: "acting-guide.txt",
              text: "First paragraph about acting.",
              chunkIndex: 0,
              contentType: "text/plain",
            },
          },
          {
            id: "acting-guide.txt#1",
            score: 0.87,
            metadata: {
              sourceBook: "acting-guide.txt",
              text: "Second paragraph about auditioning.",
              chunkIndex: 1,
              contentType: "text/plain",
            },
          },
        ],
      });

      const result = await retrieveCoachContext(
        "How do I prepare for an audition?",
        "llama-text-embed-v2",
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
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
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
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].sourceBook).toBe("acting-guide.txt#0");
    });

    it("defaults score to 0 when not provided", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
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
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].score).toBe(0);
    });

    it("defaults excerptText to empty string when text is missing from metadata", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
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
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(result[0].excerptText).toBe("");
    });
  });

  describe("empty result handling", () => {
    it("returns empty array when Pinecone returns no matches", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockResolvedValue({ matches: [] });

      const result = await retrieveCoachContext(
        "Unanswerable question?",
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(result).toEqual([]);
    });

    it("returns empty array when matches is undefined", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockResolvedValue({});

      const result = await retrieveCoachContext(
        "Unanswerable question?",
        "llama-text-embed-v2",
        defaultOptions,
        defaultDeps
      );

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("throws RetrievalError when embedding fails to return a vector", async () => {
      mockEmbed.mockResolvedValue([]);

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Failed to embed question: no embedding returned");
    });

    it("throws RetrievalError when embedding client throws", async () => {
      mockEmbed.mockRejectedValue(new Error("Embedding API quota exceeded"));

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Embedding failed");
    });

    it("throws RetrievalError when Pinecone query fails", async () => {
      mockEmbed.mockResolvedValue([new Array(768).fill(0.1)]);
      mockQuery.mockRejectedValue(new Error("Pinecone connection refused"));

      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow(RetrievalError);
      await expect(
        retrieveCoachContext(
          "How do I prepare for an audition?",
          "llama-text-embed-v2",
          defaultOptions,
          defaultDeps
        )
      ).rejects.toThrow("Pinecone query failed");
    });
  });
});
