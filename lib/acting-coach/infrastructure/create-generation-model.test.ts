jest.mock("firebase/ai", () => ({
  getAI: jest.fn(),
  getGenerativeModel: jest.fn(),
  VertexAIBackend: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(),
}));

import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";

describe("createGenerationModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads ACTING_COACH_GENERATION_MODEL from config", () => {
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

      const mockAiInstance = {};
      (getAI as jest.Mock).mockReturnValue(mockAiInstance);
      (getGenerativeModel as jest.Mock).mockReturnValue({});

      const { createGenerationModel } = require("./create-generation-model");
      createGenerationModel();

      expect(getGenerativeModel).toHaveBeenCalledWith(
        mockAiInstance,
        { model: "gemini-2.0-flash" }
      );
    });
  });

  it("creates a VertexAIBackend for the AI instance", () => {
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

      const mockAiInstance = {};
      (getAI as jest.Mock).mockReturnValue(mockAiInstance);
      (getGenerativeModel as jest.Mock).mockReturnValue({});

      const { createGenerationModel } = require("./create-generation-model");
      createGenerationModel();

      expect(VertexAIBackend).toHaveBeenCalledWith();
      expect(getAI).toHaveBeenCalled();
    });
  });

  it("returns the generative model from getGenerativeModel", () => {
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

      const mockModel = { model: "gemini-2.0-flash" };
      (getAI as jest.Mock).mockReturnValue({});
      (getGenerativeModel as jest.Mock).mockReturnValue(mockModel);

      const { createGenerationModel } = require("./create-generation-model");
      const result = createGenerationModel();

      expect(result).toBe(mockModel);
    });
  });

  it("fails fast when config throws a missing env error", () => {
    jest.isolateModules(() => {
      jest.doMock("./config", () => ({
        getActingCoachConfig: () => {
          throw new Error("Missing required environment variable: ACTING_COACH_GENERATION_MODEL");
        },
      }));

      const { createGenerationModel } = require("./create-generation-model");
      expect(() => createGenerationModel()).toThrow("ACTING_COACH_GENERATION_MODEL");
    });
  });
});
