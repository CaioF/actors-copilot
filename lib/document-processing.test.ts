import {
  validateDocumentPayload,
  documentToPromptPart,
  rtfToPlainText,
  DOCX_MIME,
} from "./document-processing";

jest.mock("mammoth", () => ({
  __esModule: true,
  default: { extractRawText: jest.fn() },
}));
import mammoth from "mammoth";

describe("validateDocumentPayload", () => {
  it("rejects non-object input", () => {
    expect(validateDocumentPayload(null)).toMatchObject({ ok: false, status: 400 });
    expect(validateDocumentPayload("hello")).toMatchObject({ ok: false, status: 400 });
  });

  it("requires data and mimeType", () => {
    expect(validateDocumentPayload({ mimeType: "text/plain" })).toMatchObject({ ok: false, error: expect.stringContaining("data") });
    expect(validateDocumentPayload({ data: "x" })).toMatchObject({ ok: false, error: expect.stringContaining("mimeType") });
  });

  it("rejects unsupported mime types", () => {
    const r = validateDocumentPayload({ data: "x", mimeType: "video/mp4" });
    expect(r).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("Unsupported document type") });
  });

  it("rejects payloads larger than 20MB decoded", () => {
    const oversized = "a".repeat(28_000_000);
    const r = validateDocumentPayload({ data: oversized, mimeType: "application/pdf" });
    expect(r).toMatchObject({ ok: false, error: "Document exceeds 20MB limit" });
  });

  it.each([
    "text/plain",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    DOCX_MIME,
    "application/rtf",
    "text/rtf",
    "text/markdown",
    "text/x-markdown",
  ])("accepts %s", (mimeType) => {
    const r = validateDocumentPayload({ data: "x", mimeType });
    expect(r.ok).toBe(true);
  });
});

describe("rtfToPlainText", () => {
  it("strips RTF control words and groups", () => {
    const rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times;}}\\f0 Hello \\b world\\b0 .\\par Second.}`;
    const out = rtfToPlainText(rtf);
    expect(out).toContain("Hello");
    expect(out).toContain("world");
    expect(out).toContain("Second");
    expect(out).not.toContain("\\rtf1");
    expect(out).not.toContain("\\fonttbl");
  });

  it("decodes \\'hh hex escapes", () => {
    expect(rtfToPlainText("caf\\'e9")).toContain("café");
  });

  it("converts \\par to newline", () => {
    expect(rtfToPlainText("a\\par b")).toBe("a\nb");
  });
});

describe("documentToPromptPart", () => {
  beforeEach(() => jest.clearAllMocks());

  it("forwards pdf as inlineData", async () => {
    const r = await documentToPromptPart({ data: "pdfbytes", mimeType: "application/pdf", name: "x.pdf" });
    expect(r).toEqual({ ok: true, part: { inlineData: { data: "pdfbytes", mimeType: "application/pdf" } } });
  });

  it("extracts docx via mammoth and returns a text part", async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: "hello world", messages: [] });
    const r = await documentToPromptPart({ data: "ZG9jeA==", mimeType: DOCX_MIME, name: "scene.docx" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("text" in r.part && r.part.text).toMatch(/scene\.docx/);
      expect("text" in r.part && r.part.text).toMatch(/hello world/);
    }
  });

  it("returns 400 when docx extraction is empty", async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: "  ", messages: [] });
    const r = await documentToPromptPart({ data: "ZG9jeA==", mimeType: DOCX_MIME, name: "empty.docx" });
    expect(r).toMatchObject({ ok: false, status: 400, error: expect.stringContaining("Could not extract") });
  });

  it("decodes rtf and strips control codes", async () => {
    const rtfBase64 = Buffer.from("{\\rtf1\\ansi Hello\\par there.}", "utf8").toString("base64");
    const r = await documentToPromptPart({ data: rtfBase64, mimeType: "application/rtf", name: "brief.rtf" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("text" in r.part && r.part.text).toMatch(/Hello/);
      expect("text" in r.part && r.part.text).toMatch(/there/);
      expect("text" in r.part && r.part.text).not.toMatch(/\\rtf1/);
    }
  });

  it("decodes markdown verbatim", async () => {
    const mdBase64 = Buffer.from("# Heading\n\n**bold** text", "utf8").toString("base64");
    const r = await documentToPromptPart({ data: mdBase64, mimeType: "text/markdown", name: "notes.md" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("text" in r.part && r.part.text).toMatch(/# Heading/);
      expect("text" in r.part && r.part.text).toMatch(/\*\*bold\*\*/);
    }
  });
});
