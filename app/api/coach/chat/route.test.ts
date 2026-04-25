import { POST } from "./route";
import { auth } from "@/lib/firebase.admin";
import { createChildLogger, logger } from "@/lib/logger";
import { retrieveCoachContext } from "@/lib/acting-coach/application/retrieve-coach-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { getUserAuditionsSummary } from "@/lib/acting-coach/application/get-audition-context";
import { createGenerationModel } from "@/lib/acting-coach/infrastructure/create-generation-model";
import { createEmbeddingClient } from "@/lib/acting-coach/infrastructure/create-embedding-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";
import { getActingCoachConfig } from "@/lib/acting-coach/infrastructure/config";

jest.mock("@/lib/firebase.admin", () => ({
  auth: {
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
  },
  db: {
    doc: jest.fn(),
    collection: jest.fn(),
  },
}));

const childLoggerMocks = {
  error: jest.fn(),
  trace: jest.fn(),
};

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
  createChildLogger: jest.fn().mockReturnValue({
    trace: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock("@/lib/acting-coach/application/retrieve-coach-context", () => ({
  retrieveCoachContext: jest.fn(),
}));

jest.mock("@/lib/acting-coach/build-coach-prompt", () => ({
  buildCoachPrompt: jest.fn(),
}));

jest.mock("@/lib/acting-coach/application/get-audition-context", () => ({
  getUserAuditionsSummary: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/create-generation-model", () => ({
  createGenerationModel: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/create-embedding-client", () => ({
  createEmbeddingClient: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/create-pinecone-client", () => ({
  createPineconeClient: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/config", () => ({
  getActingCoachConfig: jest.fn().mockReturnValue({
    embeddingModel: "test-embedding-model",
    embeddingDimension: 768,
    generationModel: "test-generation-model",
    corpusDir: "/test/corpus",
    googleCloudProject: "test-project",
    googleCloudLocation: "us-central1",
    pineconeApiKey: "test-api-key",
    pineconeIndexName: "test-index",
    pineconeNamespace: "",
  }),
}));

describe("Coach Chat Route", () => {
  let mockProfileDoc: { get: jest.Mock };
  let mockGenerationModel: { generateContent: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockProfileDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ baselineSummary: "Test actor baseline summary" }),
      }),
    };

    (auth.verifyIdToken as jest.Mock).mockResolvedValue({
      uid: "test-uid",
      email: "actor@example.com",
    });
    (auth.getUser as jest.Mock).mockResolvedValue({
      displayName: "Test Actor",
    });

    const mockDb = {
      doc: jest.fn().mockReturnValue(mockProfileDoc),
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          }),
        }),
      }),
    };
    require("@/lib/firebase.admin").db = mockDb;

    (getUserAuditionsSummary as jest.Mock).mockResolvedValue([]);

    mockGenerationModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue("Test coach reply"),
        },
      }),
    };
    (createGenerationModel as jest.Mock).mockReturnValue(mockGenerationModel);

    (createEmbeddingClient as jest.Mock).mockReturnValue({
      models: {
        embedContent: jest.fn(),
      },
    });
    (createPineconeClient as jest.Mock).mockReturnValue({
      index: jest.fn().mockReturnValue({
        namespace: jest.fn().mockReturnValue({
          query: jest.fn(),
        }),
      }),
    });

    (retrieveCoachContext as jest.Mock).mockResolvedValue([
      {
        citationNumber: 1,
        sourceBook: "Test Book",
        excerptText: "Test excerpt text",
        score: 0.95,
      },
    ]);

    (buildCoachPrompt as jest.Mock).mockReturnValue("Test composed prompt");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "NotBearer token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when content is missing", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Content is required");
  });

  it("returns 400 when content is blank", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "   " }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Content is required");
  });

  it("returns 200 with coach reply and citations on success", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question about acting" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("Test coach reply");
    expect(data.aiData.citations).toHaveLength(1);
    expect(data.aiData.citations[0]).toEqual({
      citationNumber: 1,
      sourceBook: "Test Book",
      excerptText: "Test excerpt text",
    });

    expect(auth.verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(retrieveCoachContext).toHaveBeenCalled();
    expect(buildCoachPrompt).toHaveBeenCalledWith({
      actorBaseline: "Test actor baseline summary",
      excerpts: [
        {
          citationNumber: 1,
          sourceBook: "Test Book",
          excerptText: "Test excerpt text",
          score: 0.95,
        },
      ],
      question: "Test question about acting",
      history: undefined,
      auditions: expect.any(Array),
    });
    expect(createGenerationModel).toHaveBeenCalled();
    expect(mockGenerationModel.generateContent).toHaveBeenCalledWith(
      "Test composed prompt"
    );
  });

  it("calls getUserAuditionsSummary and passes audition summaries to buildCoachPrompt", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const mockAuditions = [
      { id: "aud-1", project: "FOUNDATION", role: "TECHNICIAN", createdAt: "2024-01-01" },
      { id: "aud-2", project: "Night Watch", role: "Lead", createdAt: "2024-02-15" },
    ];
    (getUserAuditionsSummary as jest.Mock).mockResolvedValue(mockAuditions);

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Which audition should I work on?" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(getUserAuditionsSummary).toHaveBeenCalled();
    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        auditions: mockAuditions,
      })
    );
  });

  it("degrades gracefully when audition loading fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (getUserAuditionsSummary as jest.Mock).mockRejectedValue(
      new Error("Firestore error")
    );

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("Test coach reply");
    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        auditions: [],
      })
    );
  });

  it("returns 500 and logs error when retrieval service fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (retrieveCoachContext as jest.Mock).mockRejectedValue(
      new Error("Retrieval failed")
    );

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to retrieve context");
  });

  it("returns 500 and logs error when model creation fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (createGenerationModel as jest.Mock).mockImplementation(() => {
      throw new Error("Model creation failed");
    });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to initialize generation model");
  });

  it("returns 500 and logs error when generation fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    mockGenerationModel.generateContent.mockRejectedValue(
      new Error("Generation failed")
    );

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to generate response");
  });

  it("generates reply with empty citations when retrieval returns no results", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (retrieveCoachContext as jest.Mock).mockResolvedValue([]);
    (buildCoachPrompt as jest.Mock).mockReturnValue(
      "Test prompt without excerpts"
    );

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("Test coach reply");
    expect(data.aiData.citations).toHaveLength(0);

    expect(buildCoachPrompt).toHaveBeenCalledWith({
      actorBaseline: "Test actor baseline summary",
      excerpts: [],
      question: "Test question",
      history: undefined,
      auditions: expect.any(Array),
    });
  });

  it("returns 500 when Firebase token verification fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockRejectedValue(
      new Error("Invalid token")
    );

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to generate chat response");
  });
});
