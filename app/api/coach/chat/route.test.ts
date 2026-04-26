import { POST } from "./route";
import { auth } from "@/lib/firebase.admin";
import { createChildLogger, logger } from "@/lib/logger";
import { retrieveCoachContext } from "@/lib/acting-coach/application/retrieve-coach-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { getUserAuditionsSummary, getAuditionFullData } from "@/lib/acting-coach/application/get-audition-context";
import { createGenerationModel } from "@/lib/acting-coach/infrastructure/create-generation-model";
import { createPineconeInferenceClient } from "@/lib/acting-coach/infrastructure/pinecone-inference-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";
import { getActingCoachConfig } from "@/lib/acting-coach/infrastructure/config";
import { runCoachTriggeredExtraction } from "@/lib/dna/extraction/run-extraction";

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

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
  createChildLogger: jest.fn().mockReturnValue({
    trace: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
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
  getAuditionFullData: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/create-generation-model", () => ({
  createGenerationModel: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/pinecone-inference-client", () => ({
  createPineconeInferenceClient: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/create-pinecone-client", () => ({
  createPineconeClient: jest.fn(),
}));

jest.mock("@/lib/acting-coach/infrastructure/config", () => ({
  getActingCoachConfig: jest.fn().mockReturnValue({
    embeddingModel: "llama-text-embed-v2",
    embeddingDimension: 1024,
    generationModel: "gemini-2.0-flash",
    corpusDir: "/test/corpus",
    pineconeApiKey: "test-api-key",
    pineconeIndexName: "test-index",
    pineconeNamespace: "",
  }),
}));

jest.mock("@/lib/dna/extraction/run-extraction", () => ({
  runCoachTriggeredExtraction: jest.fn(),
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
    (getAuditionFullData as jest.Mock).mockResolvedValue(null);

    mockGenerationModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue(
            JSON.stringify({
              reply: "Test coach reply",
              session_focus: null,
              step_index: 0,
              mode: "informational",
              phase: null,
            })
          ),
        },
      }),
    };
    (createGenerationModel as jest.Mock).mockReturnValue(mockGenerationModel);

    (createPineconeInferenceClient as jest.Mock).mockReturnValue({
      embed: jest.fn().mockResolvedValue([new Array(1024).fill(0.1)]),
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

  it("returns 200 with coach reply on success", async () => {
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
    expect(data.aiData.session_focus).toBe(null);
    expect(data.aiData.step_index).toBe(0);
    expect(data.aiData.mode).toBe("informational");
    expect(data.aiData.phase).toBe(null);
    expect(data.aiData.action).toBe(null);
    expect(data.aiData.extractions).toBeUndefined();
    expect(data.aiData.citations).toBeUndefined();

    expect(auth.verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(retrieveCoachContext).toHaveBeenCalled();
    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        actorBaseline: "Test actor baseline summary",
        excerpts: expect.any(Array),
        question: "Test question about acting",
        auditions: expect.any(Array),
      })
    );
    expect(createGenerationModel).toHaveBeenCalled();
    expect(mockGenerationModel.generateContent).toHaveBeenCalledWith(
      "Test composed prompt"
    );
  });

  it("uses PineconeInferenceClient instead of GoogleGenAI for embeddings", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question" }),
    });

    await POST(req);

    expect(createPineconeInferenceClient).toHaveBeenCalledWith({
      apiKey: "test-api-key",
    });
  });

  it("truncates history to last 20 messages before passing to buildCoachPrompt", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const longHistory = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question", history: longHistory }),
    });

    await POST(req);

    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        history: longHistory.slice(-20),
      })
    );
  });

  it("passes all messages when history length <= 20", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

    const shortHistory = [
      { role: "user", content: "First" },
      { role: "assistant", content: "Second" },
    ];

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question", history: shortHistory }),
    });

    await POST(req);

    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ history: shortHistory })
    );
  });

  it("loads full audition data and passes it to buildCoachPrompt when auditionId is present", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    const mockAuditionData = {
      project: "FOUNDATION",
      role: "TECHNICIAN",
      performanceMap: { intro: "A character breakdown", sections: [], outro: "" },
    };
    (getAuditionFullData as jest.Mock).mockResolvedValue(mockAuditionData);

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Tell me about this role", auditionId: "aud-123" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(getAuditionFullData).toHaveBeenCalled();
    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ auditionFullData: mockAuditionData })
    );
  });

  it("degrades gracefully when audition full data loading fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (getAuditionFullData as jest.Mock).mockRejectedValue(new Error("Firestore error"));

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "Test question", auditionId: "aud-123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("Test coach reply");
    expect(buildCoachPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ auditionFullData: undefined })
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
      expect.objectContaining({ auditions: mockAuditions })
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
      expect.objectContaining({ auditions: [] })
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
    expect(data.aiData.citations).toBeUndefined();
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

  it("falls back to raw text when model returns malformed JSON", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    mockGenerationModel.generateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue("This is not JSON at all"),
      },
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

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("This is not JSON at all");
    expect(data.aiData.session_focus).toBe(null);
    expect(data.aiData.step_index).toBe(0);
    expect(data.aiData.mode).toBe("informational");
    expect(data.aiData.phase).toBe(null);
    expect(data.aiData.action).toBe(null);
  });

  it("returns action and extractions when coach model returns trigger_dna_extraction action", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    const mockExtractionData = {
      new_traits: ["deep thinker"],
      defense_mechanisms: ["intellectualization"],
      progress_assessment: { has_actionable_pattern: true, depth_score: 7 },
    };
    (runCoachTriggeredExtraction as jest.Mock).mockResolvedValue(mockExtractionData);
    mockGenerationModel.generateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(
          JSON.stringify({
            reply: "Deep insight detected",
            session_focus: null,
            step_index: 1,
            mode: "guided",
            phase: "exploration",
            action: { type: "trigger_dna_extraction" },
          })
        ),
      },
    });

    const req = new Request("http://localhost/api/coach/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ content: "I'm feeling vulnerable about my father's expectations" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.aiData.action).toEqual({ type: "trigger_dna_extraction" });
    expect(data.aiData.extractions).toEqual(mockExtractionData);
    expect(runCoachTriggeredExtraction).toHaveBeenCalledWith({
      content: "I'm feeling vulnerable about my father's expectations",
      history: expect.any(Array),
    });
  });

  it("returns reply even when extraction throws", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    (runCoachTriggeredExtraction as jest.Mock).mockRejectedValue(new Error("Extraction failed"));
    mockGenerationModel.generateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(
          JSON.stringify({
            reply: "Reply during extraction failure",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: { type: "trigger_dna_extraction" },
          })
        ),
      },
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

    expect(res.status).toBe(200);
    expect(data.aiData.coach_reply).toBe("Reply during extraction failure");
    expect(data.aiData.action).toEqual({ type: "trigger_dna_extraction" });
    expect(data.aiData.extractions).toBeUndefined();
  });

  it("returns action: null in response when coach model emits action: null", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    mockGenerationModel.generateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(
          JSON.stringify({
            reply: "Reply with null action",
            session_focus: null,
            step_index: 0,
            mode: "informational",
            phase: null,
            action: null,
          })
        ),
      },
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

    expect(res.status).toBe(200);
    expect(data.aiData.action).toBe(null);
    expect(data.aiData.extractions).toBeUndefined();
    expect(runCoachTriggeredExtraction).not.toHaveBeenCalled();
  });
});
