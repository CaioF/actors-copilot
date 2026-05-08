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

// Mocks the event-driven architecture of pdf2json
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
}));

// ============================================================================
// TYPE DEFINITIONS & UTILS
// ============================================================================

type FormDataValue = string | File | null;

/**
 * Creates a real File instance with an optionally overridden size and arrayBuffer.
 * This ensures instanceof File checks pass in the schema while keeping tests fast.
 */
function makeFile(name: string, type: string, size: number, arrayBufferValue: ArrayBuffer = new ArrayBuffer(8)): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size, configurable: true });
  Object.defineProperty(file, "arrayBuffer", {
    value: jest.fn().mockResolvedValue(arrayBufferValue),
    configurable: true,
  });
  return file;
}

/**
 * Constructs a mock Next.js Request object with strictly typed form data.
 * Avoids the use of 'any' while satisfying the expected Web API Request signature.
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
      } as unknown as FormData), // Safe structural cast for testing environments lacking native Web APIs
  } as Request;
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("POST /api/auditions/analyzeSides", () => {
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
        data: () => ({ psychology: { traits: ["Empathetic", "Intense"] } }),
      }),
    });

    // Default successful Vertex AI generation state
    mockedGetGenerativeModel.mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              intro: "Mocked AI Introduction",
              sections: [{ title: "Mocked Beat", items: ["Tactic 1", "Tactic 2"] }],
              outro: "Mocked AI Outro",
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
        sidesText: "Standard sides text",
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

  describe("Payload Validation", () => {
    it("should return 400 Bad Request when neither text nor file is provided", async () => {
      // Arrange
      const formData = { userPath: "user123_ValidActor" };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(payload.error).toBe("No sides text or valid file provided for analysis.");
    });

    it("should return 400 Bad Request when the file exceeds 20MB", async () => {
      // Arrange
      const oversizedFile = makeFile("heavy_script.pdf", "application/pdf", 21 * 1024 * 1024);
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: oversizedFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(payload.error).toBe("Validation failed");
      expect(payload.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("20MB") }),
        ])
      );
    });

    it("should return 400 Bad Request when an unsupported MIME type is uploaded", async () => {
      // Arrange
      const invalidFile = makeFile("headshot.jpg", "image/jpeg", 1024);
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: invalidFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe("Document Parsing & AI Inference", () => {
    it("should successfully process the request using plain text inputs", async () => {
      // Arrange
      const formData = {
        userPath: "user123_ValidActor",
        sidesText: "To be, or not to be.",
        projectType: "theater",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);
      const payload = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.intro).toBe("Mocked AI Introduction");
    });

    it("should successfully extract text from a DOCX file using Mammoth", async () => {
      // Arrange
      mockedMammothExtract.mockResolvedValue({ value: "Extracted DOCX content" });
      const docxFile = makeFile("script.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1024);
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: docxFile,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockedMammothExtract).toHaveBeenCalled();
    });

    it("should successfully extract text from a PDF file using pdf2json", async () => {
      // Arrange
      const pdfFile = makeFile("script.pdf", "application/pdf", 1024);
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: pdfFile,
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
        sidesText: "Standard audition text.",
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

    it("should inject priorBriefSummary into the prompt as a labeled enrichment block", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked AI Introduction",
                  sections: [{ title: "Mocked Beat", items: ["Tactic 1", "Tactic 2"] }],
                  outro: "Mocked AI Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        sidesText: "To be, or not to be.",
        priorBriefSummary: "This character is a tragic hero with a fatal flaw.",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).toContain("<prior_brief_analysis>");
      expect(capturedPrompt).toContain("This character is a tragic hero with a fatal flaw.");
    });

    it("should omit enrichment block when priorBriefSummary is absent", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked AI Introduction",
                  sections: [{ title: "Mocked Beat", items: ["Tactic 1", "Tactic 2"] }],
                  outro: "Mocked AI Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        sidesText: "To be, or not to be.",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).not.toContain("<prior_brief_analysis>");
    });

    it("should truncate priorBriefSummary exceeding 1500 characters", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked AI Introduction",
                  sections: [{ title: "Mocked Beat", items: ["Tactic 1", "Tactic 2"] }],
                  outro: "Mocked AI Outro",
                }),
            },
          });
        }),
      });

      const longSummary = "A".repeat(2000);
      const formData = {
        userPath: "user123_ValidActor",
        sidesText: "To be, or not to be.",
        priorBriefSummary: longSummary,
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      const summaryOnly = capturedPrompt.split("<prior_brief_analysis>")[1].split("</prior_brief_analysis>")[0];
      expect(summaryOnly.trim().length).toBeLessThanOrEqual(1500);
    });

   
    it("should use 'Actor' in prompt when actorName is empty string (proving || not ??)", async () => {
      // Arrange
      let capturedPrompt = "";
      mockedGetGenerativeModel.mockReturnValueOnce({
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () =>
                JSON.stringify({
                  intro: "Mocked AI Introduction",
                  sections: [{ title: "Mocked Beat", items: ["Tactic 1", "Tactic 2"] }],
                  outro: "Mocked AI Outro",
                }),
            },
          });
        }),
      });

      const formData = {
        userPath: "user123_ValidActor",
        sidesText: "To be, or not to be.",
        actorName: "",
      };
      const request = buildMockRequest("Bearer valid_token", formData);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(capturedPrompt).toContain("You are coaching Actor");
    });
  });
});
