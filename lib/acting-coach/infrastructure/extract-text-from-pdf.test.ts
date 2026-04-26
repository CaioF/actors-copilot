import { extractTextFromPDF } from "./extract-text-from-pdf";

const mockParseBuffer = jest.fn();
const mockGetRawTextContent = jest.fn();
const mockOn = jest.fn();

jest.mock("pdf2json", () => {
  return jest.fn().mockImplementation(() => ({
    on: mockOn,
    getRawTextContent: mockGetRawTextContent,
    parseBuffer: mockParseBuffer,
  }));
});

describe("extractTextFromPDF", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOn.mockReset();
    mockParseBuffer.mockReset();
    mockGetRawTextContent.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("pdf2json timeout/decode pattern", () => {
    it("uses pdf2json with parseBuffer", async () => {
      let dataReadyCallback: () => void;
      mockOn.mockImplementation((event: string, cb: () => void) => {
        if (event === "pdfParser_dataReady") {
          dataReadyCallback = cb;
        }
      });
      mockParseBuffer.mockImplementation(() => {
        dataReadyCallback?.();
      });
      mockGetRawTextContent.mockReturnValue("test content");

      const buffer = Buffer.from("fake pdf");
      await extractTextFromPDF(buffer);

      expect(mockParseBuffer).toHaveBeenCalledWith(buffer);
    });

    it("decodes URI component in extracted text", async () => {
      let dataReadyCallback: () => void;
      mockOn.mockImplementation((event: string, cb: () => void) => {
        if (event === "pdfParser_dataReady") {
          dataReadyCallback = cb;
        }
      });
      mockParseBuffer.mockImplementation(() => {
        dataReadyCallback?.();
      });
      mockGetRawTextContent.mockReturnValue("Acting%20Notes");

      const buffer = Buffer.from("fake pdf");
      const result = await extractTextFromPDF(buffer);

      expect(result).toBe("Acting Notes");
    });

    it("rejects with timeout error after configured limit", async () => {
      const timeoutHolder: { callback: (() => void) | null } = { callback: null };
      jest.spyOn(global, "setTimeout").mockImplementation(
        (fn: () => void) => {
          timeoutHolder.callback = fn;
          return 0 as unknown as NodeJS.Timeout;
        }
      );

      mockOn.mockImplementation(() => {});
      mockParseBuffer.mockImplementation(() => {});

      const buffer = Buffer.from("fake pdf");
      const promise = extractTextFromPDF(buffer);

      await new Promise((r) => setImmediate(r));

      expect(timeoutHolder.callback).not.toBeNull();
      timeoutHolder.callback!();

      await expect(promise).rejects.toThrow(
        "PDF parsing timeout exceeded (60s)."
      );
    });
  });

  describe("parser error handling", () => {
    it("surfaces descriptive error on parser error", async () => {
      let errorCallback: ((errData: { parserError: string }) => void) | null = null;
      mockOn.mockImplementation(
        (
          event: string,
          cb: (errData: { parserError: string }) => void
        ) => {
          if (event === "pdfParser_dataError") {
            errorCallback = cb;
          }
        }
      );
      mockParseBuffer.mockImplementation(() => {
        if (errorCallback) {
          errorCallback({ parserError: "PDF is malformed or corrupted" });
        }
      });

      const buffer = Buffer.from("malformed pdf");

      let caughtError: unknown;
      try {
        await extractTextFromPDF(buffer);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBe("PDF is malformed or corrupted");
    });
  });

  describe("successful extraction", () => {
    it("returns extracted text on successful parse", async () => {
      let dataReadyCallback: (() => void) | null = null;
      mockOn.mockImplementation((event: string, cb: () => void) => {
        if (event === "pdfParser_dataReady") {
          dataReadyCallback = cb;
        }
      });
      mockParseBuffer.mockImplementation(() => {
        if (dataReadyCallback) {
          dataReadyCallback();
        }
      });
      mockGetRawTextContent.mockReturnValue("Extracted acting notes");

      const buffer = Buffer.from("valid pdf");
      const result = await extractTextFromPDF(buffer);

      expect(result).toBe("Extracted acting notes");
    });
  });
});
