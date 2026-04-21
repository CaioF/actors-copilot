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

interface MockFile {
  size: number;
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

type FormDataValue = string | MockFile | null;

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

    it("should return 413 Payload Too Large when the file exceeds 20MB", async () => {
      // Arrange
      const oversizedFile: MockFile = {
        size: 21 * 1024 * 1024, // 21MB
        name: "heavy_script.pdf",
        type: "application/pdf",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      const formData = {
        userPath: "user123_ValidActor",
        sidesFile: oversizedFile,
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
        name: "headshot.jpg",
        type: "image/jpeg",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
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
      const docxFile: MockFile = {
        size: 1024,
        name: "script.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
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
      const pdfFile: MockFile = {
        size: 1024,
        name: "script.pdf",
        type: "application/pdf",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
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
  });
});