import mammoth from "mammoth";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const RTF_MIMES = ["application/rtf", "text/rtf"] as const;
export const MARKDOWN_MIMES = ["text/markdown", "text/x-markdown"] as const;

export const SUPPORTED_DOC_MIMES: readonly string[] = [
  "text/plain",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  DOCX_MIME,
  ...RTF_MIMES,
  ...MARKDOWN_MIMES,
];

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

export type AttachedDocumentPayload = {
  data: string;
  mimeType: string;
  name?: string;
};

export type PromptPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

export type DocumentValidationFailure = { ok: false; status: number; error: string };
export type DocumentValidationSuccess = { ok: true };

export function validateDocumentPayload(
  document: unknown,
): DocumentValidationFailure | (DocumentValidationSuccess & { document: AttachedDocumentPayload }) {
  if (!document || typeof document !== "object") {
    return { ok: false, status: 400, error: "Invalid document format" };
  }
  const doc = document as Partial<AttachedDocumentPayload>;
  if (!doc.data || typeof doc.data !== "string") {
    return { ok: false, status: 400, error: "Document data is required" };
  }
  if (!doc.mimeType || typeof doc.mimeType !== "string") {
    return { ok: false, status: 400, error: "Document mimeType is required" };
  }
  if (!SUPPORTED_DOC_MIMES.includes(doc.mimeType)) {
    return { ok: false, status: 400, error: `Unsupported document type: ${doc.mimeType}` };
  }
  const decodedSize = (doc.data.length * 3) / 4;
  if (decodedSize > MAX_DOCUMENT_SIZE_BYTES) {
    return { ok: false, status: 400, error: "Document exceeds 20MB limit" };
  }
  return { ok: true, document: doc as AttachedDocumentPayload };
}

export function rtfToPlainText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_m, code) => {
      const n = parseInt(code, 10);
      return String.fromCharCode(n < 0 ? n + 65536 : n);
    })
    .replace(/\\par[d]?\b ?/g, "\n")
    .replace(/\\line\b ?/g, "\n")
    .replace(/\\tab\b ?/g, "\t")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\[^a-zA-Z]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type DocumentToPromptPartFailure = { ok: false; status: number; error: string };
export type DocumentToPromptPartSuccess = { ok: true; part: PromptPart };

/**
 * Converts a validated document payload into a prompt part suitable for Gemini.
 * Text-bearing formats (docx, rtf, markdown) are decoded server-side; binary
 * formats Gemini accepts natively (pdf, images, plain text) are passed via inlineData.
 */
export async function documentToPromptPart(
  document: AttachedDocumentPayload,
): Promise<DocumentToPromptPartFailure | DocumentToPromptPartSuccess> {
  const fallbackName = document.name ?? "document";

  if (document.mimeType === DOCX_MIME) {
    try {
      const buffer = Buffer.from(document.data, "base64");
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || !result.value.trim()) {
        return {
          ok: false,
          status: 400,
          error: "Could not extract text from the .docx file. It may be empty, password-protected, or corrupted.",
        };
      }
      return {
        ok: true,
        part: { text: `\n\n--- Attached document: ${fallbackName} ---\n${result.value}` },
      };
    } catch {
      return { ok: false, status: 400, error: "Failed to read the attached .docx file." };
    }
  }

  if ((RTF_MIMES as readonly string[]).includes(document.mimeType)) {
    try {
      const rtfText = Buffer.from(document.data, "base64").toString("utf8");
      const extracted = rtfToPlainText(rtfText);
      if (!extracted) {
        return {
          ok: false,
          status: 400,
          error: "Could not extract text from the .rtf file. It may be empty or corrupted.",
        };
      }
      return {
        ok: true,
        part: { text: `\n\n--- Attached document: ${fallbackName} ---\n${extracted}` },
      };
    } catch {
      return { ok: false, status: 400, error: "Failed to read the attached .rtf file." };
    }
  }

  if ((MARKDOWN_MIMES as readonly string[]).includes(document.mimeType)) {
    const mdText = Buffer.from(document.data, "base64").toString("utf8");
    return {
      ok: true,
      part: { text: `\n\n--- Attached document: ${fallbackName} ---\n${mdText}` },
    };
  }

  return {
    ok: true,
    part: { inlineData: { data: document.data, mimeType: document.mimeType } },
  };
}
