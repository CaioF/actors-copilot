// ============================================================================
// EXTERNAL DEPENDENCY MOCKS — must be declared BEFORE route imports
// ============================================================================

jest.mock("@/lib/firebase.admin", () => ({
  auth: { verifyIdToken: jest.fn() },
  db: { doc: jest.fn() },
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("mammoth", () => ({
  extractRawText: jest.fn(),
}));

jest.mock("pdf2json", () => {
  return jest.fn().mockImplementation(() => {
    const callbacks: Record<string, () => void> = {};
    return {
      on: (event: string, callback: () => void) => {
        callbacks[event] = callback;
      },
      getRawTextContent: () => "Mocked PDF text content",
      parseBuffer: () => {
        if (callbacks["pdfParser_dataReady"]) {
          callbacks["pdfParser_dataReady"]();
        }
      },
    };
  });
});

jest.mock("firebase/ai", () => ({
  getAI: jest.fn(),
  getGenerativeModel: jest.fn(),
  VertexAIBackend: jest.fn(),
  SchemaType: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY" },
}));

jest.mock("@/lib/firebase", () => ({
  getApp: jest.fn(),
  getDb: jest.fn(() => ({})),
  isFirebaseConfigured: jest.fn(() => true),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: "test-uid",
      displayName: "Test Actor",
      getIdToken: jest.fn().mockResolvedValue("mock-token"),
    },
  })),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb({ uid: "test-uid", displayName: "Test Actor" });
    return jest.fn();
  }),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, path) => ({ _doc: true, _path: typeof path === "string" ? path : _db })),
  getDoc: jest.fn(),
}));

jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn(() => jest.fn()),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ============================================================================
// IMPORTS — after mocks are in place
// ============================================================================

import { POST as analyzeSides } from "@/app/api/auditions/analyzeSides/route";
import { POST as analyzeBrief } from "@/app/api/auditions/analyzeBrief/route";
import { auth, db } from "@/lib/firebase.admin";
import { getGenerativeModel } from "firebase/ai";
import mammoth from "mammoth";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MockFile {
  size: number;
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

type FormDataValue = string | MockFile | null;

const buildMockRequest = (
  authHeader: string | null,
  formDataEntries: Record<string, FormDataValue>
): Request => {
  return {
    headers: {
      get: (headerName: string): string | null => {
        if (headerName.toLowerCase() === "authorization") return authHeader;
        return null;
      },
    },
    formData: () =>
      Promise.resolve({
        get: (key: string): FormDataValue => formDataEntries[key] ?? null,
        has: (key: string): boolean => key in formDataEntries,
      } as unknown as FormData),
  } as Request;
};

// ============================================================================
// Integration Tests: Sides → Brief enrichment lifecycle
// ============================================================================
describe("Sides → Brief enrichment integration", () => {
  const mockedVerifyIdToken = auth.verifyIdToken as jest.Mock;
  const mockedDbDoc = db.doc as jest.Mock;
  const mockedMammothExtract = mammoth.extractRawText as jest.Mock;
  const mockedGetGenerativeModel = getGenerativeModel as jest.Mock;

  const sidesResult = {
    intro: "Sides intro - Hamlet Act 3",
    sections: [
      { title: "To be, or not to be", items: ["That is the question", "Whether tis nobler"] },
    ],
    outro: "Sides outro",
  };

  const briefResult = {
    intro: "Brief intro - Hamlet character study",
    sections: [{ title: "Psychology", items: ["Tragic hero archetype", "Indecision flaw"] }],
    outro: "Brief outro",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedVerifyIdToken.mockResolvedValue({ uid: "user123" });

    mockedDbDoc.mockImplementation((path: string) => {
      if (path.includes("master")) {
        return {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ psychology: { traits: ["Empathetic", "Intense"] } }),
          }),
        };
      }
      return { get: jest.fn(), set: jest.fn(), add: jest.fn() };
    });

    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => JSON.stringify(briefResult) },
      }),
    }));

    mockedMammothExtract.mockResolvedValue({ value: "" });
  });

  it("analyzeSides with priorBriefSummary injects enrichment block into prompt", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(sidesResult) },
        });
      }),
    }));

    const priorBrief =
      "Hamlet is a tragic hero with a fatal flaw of indecision. He speaks in iambic pentameter.";
    const formData = {
      userPath: "user123_TestActor",
      sidesText: "To be, or not to be, that is the question",
      priorBriefSummary: priorBrief,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeSides(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(capturedPrompt).toContain("=== PRIOR CHARACTER BRIEF ANALYSIS ===");
    expect(capturedPrompt).toContain(priorBrief);
  });

  it("analyzeBrief with priorSidesSummary injects enrichment block into prompt", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(briefResult) },
        });
      }),
    }));

    const priorSides =
      "Hamlet's to be or not to be soliloquy in Act 3. He contemplates mortality and indecision.";
    const formData = {
      userPath: "user123_TestActor",
      briefText: "Hamlet is the tragic prince of Denmark. He is melancholic and indecisive.",
      priorSidesSummary: priorSides,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeBrief(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(capturedPrompt).toContain("=== PRIOR SIDES ANALYSIS ===");
    expect(capturedPrompt).toContain(priorSides);
  });

  it("analyzeBrief omits enrichment block when priorSidesSummary is absent", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(briefResult) },
        });
      }),
    }));

    const formData = {
      userPath: "user123_TestActor",
      briefText: "Hamlet is the tragic prince of Denmark.",
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeBrief(request);

    expect(response.status).toBe(200);
    expect(capturedPrompt).not.toContain("=== PRIOR SIDES ANALYSIS ===");
  });

  it("analyzeSides omits enrichment block when priorBriefSummary is absent", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(sidesResult) },
        });
      }),
    }));

    const formData = {
      userPath: "user123_TestActor",
      sidesText: "To be, or not to be.",
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeSides(request);

    expect(response.status).toBe(200);
    expect(capturedPrompt).not.toContain("=== PRIOR CHARACTER BRIEF ANALYSIS ===");
  });

  it("analyzeSides truncates priorBriefSummary exceeding 1500 chars", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(sidesResult) },
        });
      }),
    }));

    const longSummary = "x".repeat(2000);
    const formData = {
      userPath: "user123_TestActor",
      sidesText: "To be, or not to be.",
      priorBriefSummary: longSummary,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeSides(request);

    expect(response.status).toBe(200);
    const afterLabel = capturedPrompt.split("=== PRIOR CHARACTER BRIEF ANALYSIS ===")[1];
    const summaryOnly = afterLabel.split("CRITICAL:")[0];
    expect(summaryOnly.trim().length).toBeLessThanOrEqual(1500);
  });

  it("analyzeBrief truncates priorSidesSummary exceeding 1500 chars", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(briefResult) },
        });
      }),
    }));

    const longSummary = "y".repeat(2000);
    const formData = {
      userPath: "user123_TestActor",
      briefText: "Hamlet is the tragic prince.",
      priorSidesSummary: longSummary,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeBrief(request);

    expect(response.status).toBe(200);
    const afterLabel = capturedPrompt.split("=== PRIOR SIDES ANALYSIS ===")[1];
    expect(afterLabel.trim().length).toBeLessThanOrEqual(1500);
  });

  it("enrichment block appears after CHARACTER BRIEF section in Brief route", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(briefResult) },
        });
      }),
    }));

    const formData = {
      userPath: "user123_TestActor",
      briefText: "Hamlet is the tragic prince of Denmark.",
      priorSidesSummary: "Hamlet's soliloquy about being or not being.",
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    await analyzeBrief(request);

    const briefSectionIdx = capturedPrompt.indexOf("CHARACTER BRIEF / CASTING NOTES:");
    const enrichIdx = capturedPrompt.indexOf("=== PRIOR SIDES ANALYSIS ===");
    expect(briefSectionIdx).toBeLessThan(enrichIdx);
    expect(enrichIdx).toBeGreaterThan(0);
  });
});

// ============================================================================
// Integration Tests: Brief → Sides enrichment lifecycle
// ============================================================================
describe("Brief → Sides enrichment integration", () => {
  const mockedVerifyIdToken = auth.verifyIdToken as jest.Mock;
  const mockedDbDoc = db.doc as jest.Mock;
  const mockedMammothExtract = mammoth.extractRawText as jest.Mock;
  const mockedGetGenerativeModel = getGenerativeModel as jest.Mock;

  const briefResult = {
    intro: "Brief intro - Character study of Ophelia",
    sections: [{ title: "Emotional State", items: ["Grief", "Confusion", "Betrayal"] }],
    outro: "Brief outro",
  };

  const sidesResult = {
    intro: "Sides intro - Ophelia Act 4",
    sections: [{ title: "Opportunity", items: ["There's rosemary", "That's for remembrance"] }],
    outro: "Sides outro",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedVerifyIdToken.mockResolvedValue({ uid: "user123" });

    mockedDbDoc.mockImplementation((path: string) => {
      if (path.includes("master")) {
        return {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ psychology: { traits: ["Emotional", "Nurturing"] } }),
          }),
        };
      }
      return { get: jest.fn(), set: jest.fn(), add: jest.fn() };
    });

    mockedMammothExtract.mockResolvedValue({ value: "" });
  });

  it("analyzeBrief with priorSidesSummary injects enrichment block into prompt", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(briefResult) },
        });
      }),
    }));

    const priorSides = "Ophelia's scene in Act 4 where she distributes flowers and speaks of betrayal.";
    const formData = {
      userPath: "user123_TestActor",
      briefText: "Ophelia is a gentle character. She is naive and easily influenced.",
      priorSidesSummary: priorSides,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeBrief(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(capturedPrompt).toContain("=== PRIOR SIDES ANALYSIS ===");
    expect(capturedPrompt).toContain(priorSides);
  });

  it("analyzeSides with priorBriefSummary injects enrichment block into prompt", async () => {
    let capturedPrompt = "";
    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        capturedPrompt = prompt;
        return Promise.resolve({
          response: { text: () => JSON.stringify(sidesResult) },
        });
      }),
    }));

    const priorBrief = "Ophelia is characterized by her gentle and naive nature. She is easily manipulated.";
    const formData = {
      userPath: "user123_TestActor",
      sidesText: "There's rosemary, that's for remembrance. Pray you love, remember.",
      priorBriefSummary: priorBrief,
    };
    const request = buildMockRequest("Bearer valid_token", formData);

    const response = await analyzeSides(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(capturedPrompt).toContain("=== PRIOR CHARACTER BRIEF ANALYSIS ===");
    expect(capturedPrompt).toContain(priorBrief);
  });

  it("both directions respect 1500-char truncation boundary", async () => {
    let sidesPrompt = "";
    let briefPrompt = "";

    mockedGetGenerativeModel.mockImplementation((_ai, _config) => ({
      generateContent: jest.fn().mockImplementation((prompt: string) => {
        if (prompt.includes("AUDITION SIDES")) {
          sidesPrompt = prompt;
        } else {
          briefPrompt = prompt;
        }
        return Promise.resolve({
          response: {
            text: () =>
              JSON.stringify({
                intro: "Intro",
                sections: [{ title: "Section", items: ["Item"] }],
                outro: "Outro",
              }),
          },
        });
      }),
    }));

    const longSides = "s".repeat(2000);
    const longBrief = "b".repeat(2000);

    const sidesReq = buildMockRequest("Bearer valid_token", {
      userPath: "user123_TestActor",
      sidesText: "Some sides text",
      priorBriefSummary: longBrief,
    });
    const briefReq = buildMockRequest("Bearer valid_token", {
      userPath: "user123_TestActor",
      briefText: "Some brief text",
      priorSidesSummary: longSides,
    });

    await analyzeSides(sidesReq);
    await analyzeBrief(briefReq);

    const sidesEnrichBlock = sidesPrompt.split("=== PRIOR CHARACTER BRIEF ANALYSIS ===")[1].split("CRITICAL:")[0];
    expect(sidesEnrichBlock.trim().length).toBeLessThanOrEqual(1500);

    const briefEnrichBlock = briefPrompt.split("=== PRIOR SIDES ANALYSIS ===")[1];
    expect(briefEnrichBlock.trim().length).toBeLessThanOrEqual(1500);
  });
});

