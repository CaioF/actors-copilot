jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({})),
}));

import { GoogleGenAI } from "@google/genai";

describe("createEmbeddingClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates GoogleGenAI with vertexai: true, project, and location", () => {
    const mockConfig = {
      googleCloudProject: "test-project",
      googleCloudLocation: "us-central1",
      embeddingModel: "text-embedding-004",
      embeddingDimension: 768,
      generationModel: "gemini-2.0-flash",
      corpusDir: "/corpus",
      pineconeApiKey: "test-key",
      pineconeIndexName: "test-index",
      pineconeNamespace: "",
    };

    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => mockConfig,
      }));

      const { createEmbeddingClient } = require("./create-embedding-client");
      createEmbeddingClient();

      expect(GoogleGenAI).toHaveBeenCalledWith({
        vertexai: true,
        project: "test-project",
        location: "us-central1",
      });
    });
  });

  it("returns a GoogleGenAI instance", () => {
    const mockConfig = {
      googleCloudProject: "test-project",
      googleCloudLocation: "us-central1",
      embeddingModel: "text-embedding-004",
      embeddingDimension: 768,
      generationModel: "gemini-2.0-flash",
      corpusDir: "/corpus",
      pineconeApiKey: "test-key",
      pineconeIndexName: "test-index",
      pineconeNamespace: "",
    };

    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => mockConfig,
      }));

      const { createEmbeddingClient } = require("./create-embedding-client");
      const client = createEmbeddingClient();

      expect(client).toBeDefined();
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    });
  });
});
