import { POST } from "./route";
import { auth } from "@/lib/firebase.admin";
import { retrieveCoachContext } from "@/lib/acting-coach/application/retrieve-coach-context";
import { buildCoachPrompt } from "@/lib/acting-coach/build-coach-prompt";
import { getUserAuditionsSummary, getAuditionFullData } from "@/lib/acting-coach/application/get-audition-context";
import { createPineconeInferenceClient } from "@/lib/acting-coach/infrastructure/pinecone-inference-client";
import { createPineconeClient } from "@/lib/acting-coach/infrastructure/create-pinecone-client";

// --- Global Mocks ---
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
    debug: jest.fn(),
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

// --- New Firebase AI Mocks ---
const mockGenerateContent = jest.fn();

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(),
}));

jest.mock("firebase/ai", () => {
  class MockVertexAIBackend {
    constructor(location: string) {}
  }
  return {
    getAI: jest.fn(),
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
    VertexAIBackend: MockVertexAIBackend,
  };
});

describe("Coach Chat Route", () => {
  let mockProfileDoc: { get: jest.Mock };
  let mockActorProfileDoc: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockProfileDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ baselineSummary: "Test actor baseline summary" }),
      }),
    };

    mockActorProfileDoc = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ bio: "Existing bio", credits: [] }),
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
      doc: jest.fn((path: string) => path.startsWith("actorProfiles/") ? mockActorProfileDoc : mockProfileDoc),
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

    mockGenerateContent.mockResolvedValue({
      response: {
        text: jest.fn().mockReturnValue("Test coach reply"),
      },
    });

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

  // --- Authentication & Basic Validation Tests ---

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

    // Verify Firebase AI was called with the composed prompt
    expect(mockGenerateContent).toHaveBeenCalledWith([
      { text: "Test composed prompt" }
    ]);
  });

  // --- Document Validation Tests (Task 4) ---

  describe("Document Validation", () => {
    it("returns 400 when document has missing properties", async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

      const req = new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ content: "Test", document: { data: "base64" } }), // Missing mimeType
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("mimeType is required");
    });

    it("returns 400 when document has unsupported MIME type", async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

      const req = new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ 
          content: "Test", 
          document: { data: "base64", mimeType: "video/mp4", name: "test.mp4" } 
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Unsupported document type");
    });

    it("returns 400 when document exceeds 20MB limit", async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

      // Create a dummy base64 string that exceeds 20MB when decoded
      // 20MB = 20971520 bytes. Base64 size = (bytes * 4) / 3 = ~27962027 chars
      const oversizedData = "a".repeat(28000000); 

      const req = new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ 
          content: "Test", 
          document: { data: oversizedData, mimeType: "application/pdf", name: "large.pdf" } 
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Document exceeds 20MB limit");
    });

    it("includes inlineData in AI prompt when valid document is provided", async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

      const req = new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ 
          content: "Analyze this script", 
          document: { data: "dGVzdCBiYXNlNjQ=", mimeType: "application/pdf", name: "script.pdf" } 
        }),
      });

      const res = await POST(req);
      
      expect(res.status).toBe(200);
      expect(mockGenerateContent).toHaveBeenCalledWith([
        { text: "Test composed prompt" },
        { inlineData: { data: "dGVzdCBiYXNlNjQ=", mimeType: "application/pdf" } }
      ]);
    });
  });

  // --- Context & History Handling ---

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

  // --- Error Handling ---

  it("returns 500 and logs error when generation fails", async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });
    
    mockGenerateContent.mockRejectedValue(new Error("Generation failed"));

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

  describe("Actor Profile Section", () => {
    it("includes actorProfile data when provided in buildCoachPrompt call", async () => {
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: "test-uid" });

      const req = new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({ content: "Test question about my profile" }),
      });

      await POST(req);

      expect(buildCoachPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          actorProfile: expect.stringContaining("Existing bio"),
        })
      );
    });
  });
});
