jest.mock("@pinecone-database/pinecone", () => ({
  Pinecone: jest.fn().mockImplementation(() => ({})),
}));

import { Pinecone } from "@pinecone-database/pinecone";

describe("createPineconeClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a Pinecone client with the configured API key", () => {
    const mockConfig = {
      googleCloudProject: "test-project",
      googleCloudLocation: "us-central1",
      embeddingModel: "text-embedding-004",
      embeddingDimension: 768,
      generationModel: "gemini-2.0-flash",
      corpusDir: "/corpus",
      pineconeApiKey: "test-pinecone-key",
      pineconeIndexName: "acting-coach-index",
      pineconeNamespace: "test-namespace",
    };

    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => mockConfig,
      }));

      const { createPineconeClient } = require("./create-pinecone-client");
      createPineconeClient();

      expect(Pinecone).toHaveBeenCalledWith({
        apiKey: "test-pinecone-key",
      });
    });
  });

  it("returns a Pinecone instance", () => {
    const mockConfig = {
      googleCloudProject: "test-project",
      googleCloudLocation: "us-central1",
      embeddingModel: "text-embedding-004",
      embeddingDimension: 768,
      generationModel: "gemini-2.0-flash",
      corpusDir: "/corpus",
      pineconeApiKey: "test-pinecone-key",
      pineconeIndexName: "acting-coach-index",
      pineconeNamespace: "",
    };

    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => mockConfig,
      }));

      const { createPineconeClient } = require("./create-pinecone-client");
      const client = createPineconeClient();

      expect(client).toBeDefined();
      expect(Pinecone).toHaveBeenCalledTimes(1);
    });
  });

  it("throws a config error when PINECONE_API_KEY is missing", () => {
    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => {
          throw new Error("Missing required environment variable: PINECONE_API_KEY");
        },
      }));

      const { createPineconeClient } = require("./create-pinecone-client");
      expect(() => createPineconeClient()).toThrow("PINECONE_API_KEY");
    });
  });
});
