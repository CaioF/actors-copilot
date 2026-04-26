describe("ActingCoachConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("when required environment variables are missing", () => {
    it("throws a descriptive error when ACTING_COACH_EMBEDDING_MODEL is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.PINECONE_API_KEY = "test-key";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.ACTING_COACH_EMBEDDING_MODEL;

      expect(() => {
        require("./config").getActingCoachConfig();
      }).toThrow(/ACTING_COACH_EMBEDDING_MODEL/i);
    });

    it("throws a descriptive error when ACTING_COACH_EMBEDDING_DIMENSION is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "llama-text-embed-v2";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.PINECONE_API_KEY = "test-key";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.ACTING_COACH_EMBEDDING_DIMENSION;

      expect(() => {
        require("./config").getActingCoachConfig();
      }).toThrow(/ACTING_COACH_EMBEDDING_DIMENSION/i);
    });

    it("throws a descriptive error when PINECONE_API_KEY is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "llama-text-embed-v2";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.PINECONE_API_KEY;

      expect(() => {
        require("./config").getActingCoachConfig();
      }).toThrow(/PINECONE_API_KEY/i);
    });

    it("throws a descriptive error when PINECONE_INDEX_NAME is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "llama-text-embed-v2";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.PINECONE_API_KEY = "test-key";

      delete process.env.PINECONE_INDEX_NAME;

      expect(() => {
        require("./config").getActingCoachConfig();
      }).toThrow(/PINECONE_INDEX_NAME/i);
    });
  });

  describe("when all required environment variables are present", () => {
    beforeEach(() => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "llama-text-embed-v2";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.PINECONE_API_KEY = "test-pinecone-key";
      process.env.PINECONE_INDEX_NAME = "acting-coach-index";
      process.env.PINECONE_NAMESPACE = "test-namespace";
    });

    it("parses env values into a typed config object", () => {
      const config = require("./config").getActingCoachConfig();
      expect(config.embeddingModel).toBe("llama-text-embed-v2");
      expect(config.embeddingDimension).toBe(768);
      expect(config.generationModel).toBe("gemini-2.0-flash");
      expect(config.corpusDir).toBe("/corpus");
    });

    it("does not include Google Cloud fields", () => {
      const config = require("./config").getActingCoachConfig();
      expect((config as Record<string, unknown>).googleCloudProject).toBeUndefined();
      expect((config as Record<string, unknown>).googleCloudLocation).toBeUndefined();
    });

    it("includes Pinecone config", () => {
      const config = require("./config").getActingCoachConfig();
      expect(config.pineconeApiKey).toBe("test-pinecone-key");
      expect(config.pineconeIndexName).toBe("acting-coach-index");
    });

    it("parses optional PINECONE_NAMESPACE when present", () => {
      const config = require("./config").getActingCoachConfig();
      expect(config.pineconeNamespace).toBe("test-namespace");
    });

    it("defaults PINECONE_NAMESPACE to empty string when not set", () => {
      delete process.env.PINECONE_NAMESPACE;
      const config = require("./config").getActingCoachConfig();
      expect(config.pineconeNamespace).toBe("");
    });

    it("caches the config so subsequent calls return the same object", () => {
      const { getActingCoachConfig } = require("./config");
      const config1 = getActingCoachConfig();
      const config2 = getActingCoachConfig();
      expect(config1).toBe(config2);
    });
  });
});
