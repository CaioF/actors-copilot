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
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
      process.env.PINECONE_API_KEY = "test-key";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.ACTING_COACH_EMBEDDING_MODEL;

      expect(() => {
        require("./config").actingCoachConfig;
      }).toThrow(/ACTING_COACH_EMBEDDING_MODEL/i);
    });

    it("throws a descriptive error when ACTING_COACH_EMBEDDING_DIMENSION is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "text-embedding-004";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
      process.env.PINECONE_API_KEY = "test-key";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.ACTING_COACH_EMBEDDING_DIMENSION;

      expect(() => {
        require("./config").actingCoachConfig;
      }).toThrow(/ACTING_COACH_EMBEDDING_DIMENSION/i);
    });

    it("throws a descriptive error when PINECONE_API_KEY is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "text-embedding-004";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
      process.env.PINECONE_INDEX_NAME = "test-index";

      delete process.env.PINECONE_API_KEY;

      expect(() => {
        require("./config").actingCoachConfig;
      }).toThrow(/PINECONE_API_KEY/i);
    });

    it("throws a descriptive error when PINECONE_INDEX_NAME is missing", () => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "text-embedding-004";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
      process.env.PINECONE_API_KEY = "test-key";

      delete process.env.PINECONE_INDEX_NAME;

      expect(() => {
        require("./config").actingCoachConfig;
      }).toThrow(/PINECONE_INDEX_NAME/i);
    });
  });

  describe("when all required environment variables are present", () => {
    beforeEach(() => {
      process.env.ACTING_COACH_EMBEDDING_MODEL = "text-embedding-004";
      process.env.ACTING_COACH_EMBEDDING_DIMENSION = "768";
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
      process.env.ACTING_COACH_CORPUS_DIR = "/corpus";
      process.env.GOOGLE_CLOUD_PROJECT = "test-project";
      process.env.GOOGLE_CLOUD_LOCATION = "us-central1";
      process.env.PINECONE_API_KEY = "test-pinecone-key";
      process.env.PINECONE_INDEX_NAME = "acting-coach-index";
      process.env.PINECONE_NAMESPACE = "test-namespace";
    });

    it("parses env values into a typed config object", () => {
      const { actingCoachConfig } = require("./config");
      expect(actingCoachConfig.embeddingModel).toBe("text-embedding-004");
      expect(actingCoachConfig.embeddingDimension).toBe(768);
      expect(actingCoachConfig.generationModel).toBe("gemini-2.0-flash");
      expect(actingCoachConfig.corpusDir).toBe("/corpus");
    });

    it("includes Google Cloud config for Vertex AI", () => {
      const { actingCoachConfig } = require("./config");
      expect(actingCoachConfig.googleCloudProject).toBe("test-project");
      expect(actingCoachConfig.googleCloudLocation).toBe("us-central1");
    });

    it("includes Pinecone config", () => {
      const { actingCoachConfig } = require("./config");
      expect(actingCoachConfig.pineconeApiKey).toBe("test-pinecone-key");
      expect(actingCoachConfig.pineconeIndexName).toBe("acting-coach-index");
    });

    it("parses optional PINECONE_NAMESPACE when present", () => {
      const { actingCoachConfig } = require("./config");
      expect(actingCoachConfig.pineconeNamespace).toBe("test-namespace");
    });

    it("defaults PINECONE_NAMESPACE to empty string when not set", () => {
      delete process.env.PINECONE_NAMESPACE;
      const { actingCoachConfig } = require("./config");
      expect(actingCoachConfig.pineconeNamespace).toBe("");
    });

    it("caches the config so subsequent calls return the same object", () => {
      const { actingCoachConfig: config1 } = require("./config");
      const { actingCoachConfig: config2 } = require("./config");
      expect(config1).toBe(config2);
    });
  });
});
