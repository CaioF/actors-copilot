import { POST } from "./route";
import { auth, db } from "@/lib/firebase.admin";
import mammoth from "mammoth";
import { logger } from "@/lib/logger";
import { getGenerativeModel } from "firebase/ai";

// ============================================================================
// EXTERNAL DEPENDENCY MOCKS
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

// Mocks the event-driven architecture of pdf2json to simulate successful parsing
jest.mock("pdf2json", () => {
  return jest.fn().mockImplementation(() => {
    const callbacks: Record<string, () => void> = {};
    return {
      on: (event: string, callback: () => void) => {
        callbacks[event] = callback;
      },
      getRawTextContent: () => "Mocked Character Brief PDF content",
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
}));

// ============================================================================
// TYPE DEFINITIONS & UTILS
// ============================================================================

interface MockFile {
  size: number;
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

type FormDataValue = string | MockFile | null;

/**
 * Constructs a mock Next.js Request object with strictly typed form data.
 * Implements the `.has()` method specifically required by the Brief endpoint's logic.
 */
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
      } as unknown as FormData), // Safe structural cast for testing environments
  } as Request;
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("POST /api/auditions/analyzeBrief", () => {
  const mockedVerifyIdToken = auth.verifyIdToken as jest.Mock;
  const mockedDbDoc = db.doc as jest.Mock;
  const mockedMammothExtract = mammoth.extractRawText as jest.Mock;
  const mockedGetGenerativeModel = getGenerativeModel as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful Auth state
    mockedVerifyIdToken.mockResolvedValue({ uid: "user123" });

    // Default successful Firestore state (Actor DNA Profile)
    mockedDbDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ history: { keyEntities: ["Worked with Ridley Scott"] } }),
      }),
    });

    // Default successful Vertex AI generation state
    mockedGetGenerativeModel.mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              intro: "Mocked Brief Analysis Introduction",
              sections: [{ title: "World Building", items: ["Tone is gritty", "Pacing is fast"] }],
              outro: "Mocked Brief Analysis Outro",
            }),
        },
      }),
    });
  });

  describe("Authentication & Authorization", () => {
    it("should return 401 Unauthorized when the authorization header is missing", async () => {
      // Arrange
      const request = buildMockRequest(null, {});

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(payload.error).toBe("Missing auth token");
    });

    it("should return 403 Forbidden when an actor attempts to access another user's path", async () => {
      // Arrange
      const formData = {
        userPath: "maliciousUser999_Invader", // Path mismatches authenticated UID 'user123'
        briefText: "Standard brief text",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(payload.error).toBe("Unauthorized access to this path.");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: expect.stringContaining("SECURITY ALERT") })
      );
    });
  });

  describe("Payload Validation & Endpoint Integrity", () => {
    it("should return 400 Bad Request if 'sidesFile' is erroneously sent to the brief endpoint", async () => {
      // Arrange
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: "Maliciously injected sides file", // Should trigger explicit rejection
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(payload.error).toContain("strictly for Brief analysis");
    });

    it("should return 400 Bad Request when neither text nor file is provided", async () => {
      // Arrange
      const formData = { userPath: "user123_ValidActor" };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(payload.error).toBe("No brief text or valid file provided for analysis.");
    });

    it("should return 413 Payload Too Large when the brief file exceeds 20MB", async () => {
      // Arrange
      const oversizedFile: MockFile = {
        size: 21 * 1024 * 1024, // 21MB
        name: "massive_director_notes.pdf",
        type: "application/pdf",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      const formData = {
        userPath: "user123_ValidActor",
        briefFile: oversizedFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(413);
    });

    it("should return 400 Bad Request when an unsupported MIME type is uploaded", async () => {
      // Arrange
      const invalidFile: MockFile = {
        size: 1024,
        name: "moodboard.png",
        type: "image/png",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      const formData = {
        userPath: "user123_ValidActor",
        briefFile: invalidFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(logger.error).not.toHaveBeenCalled(); // Handled gracefully, not an internal error
    });
  });

  describe("Document Parsing & AI Inference", () => {
    it("should successfully process the request using plain text inputs", async () => {
      // Arrange
      const formData = {
        userPath: "user123_ValidActor",
        briefText: "Character is a cynical detective with a heart of gold.",
        projectType: "cinematic",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.intro).toBe("Mocked Brief Analysis Introduction");
    });

    it("should successfully extract text from a DOCX brief file using Mammoth", async () => {
      // Arrange
      mockedMammothExtract.mockResolvedValue({ value: "Extracted DOCX brief content" });
      const docxFile: MockFile = {
        size: 1024,
        name: "casting_notes.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      const formData = {
        userPath: "user123_ValidActor",
        briefFile: docxFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockedMammothExtract).toHaveBeenCalled();
    });

    it("should successfully extract text from a PDF brief file using pdf2json", async () => {
      // Arrange
      const pdfFile: MockFile = {
        size: 1024,
        name: "character_breakdown.pdf",
        type: "application/pdf",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      const formData = {
        userPath: "user123_ValidActor",
        briefFile: pdfFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it("should return 502 Bad Gateway if the AI returns malformed JSON", async () => {
      // Arrange
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => "Plain text response instead of JSON. This will crash JSON.parse().",
          },
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        briefText: "Standard brief text.",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(502);
      expect(payload.error).toBe("AI returned malformed data.");
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Failed to parse AI JSON output" })
      );
    });

    it("should include deadline and auditionTimezone in the prompt when provided", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked Brief Analysis Introduction",
                  sections: [{ title: "World Building", items: ["Tone is gritty", "Pacing is fast"] }],
                  outro: "Mocked Brief Analysis Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        briefText: "Character is a cynical detective.",
        deadline: "2026-06-15T14:00",
        auditionTimezone: "America/Los_Angeles",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).toContain("Deadline: 2026-06-15");
      expect(capturedPrompt).toContain("Project Timezone: America/Los_Angeles");
    });

    it("should omit deadline line from prompt when deadline is missing", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked Brief Analysis Introduction",
                  sections: [{ title: "World Building", items: ["Tone is gritty", "Pacing is fast"] }],
                  outro: "Mocked Brief Analysis Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        briefText: "Character is a cynical detective.",
        auditionTimezone: "America/Los_Angeles",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).not.toContain("Deadline:");
      expect(capturedPrompt).toContain("Project Timezone: America/Los_Angeles");
    });

    it("should omit timezone line from prompt when auditionTimezone is missing", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked Brief Analysis Introduction",
                  sections: [{ title: "World Building", items: ["Tone is gritty", "Pacing is fast"] }],
                  outro: "Mocked Brief Analysis Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        briefText: "Character is a cynical detective.",
        deadline: "2026-06-15T14:00",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).toContain("Deadline: 2026-06-15");
      expect(capturedPrompt).not.toContain("Project Timezone:");
    });
  });
});