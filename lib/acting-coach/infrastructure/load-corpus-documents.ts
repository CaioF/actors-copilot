import * as fs from "fs";
import * as path from "path";
import { extractTextFromPDF } from "./extract-text-from-pdf";
import { ActingLibraryDocument } from "../domain/acting-library-types";

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf"];
const UNSUPPORTED_MARKUP = [".doc", ".docx", ".epub"];

export async function loadCorpusDocuments(
  corpusDir: string
): Promise<ActingLibraryDocument[]> {
  if (!fs.existsSync(corpusDir)) {
    throw new Error(`Corpus directory does not exist: ${corpusDir}`);
  }

  const entries = fs.readdirSync(corpusDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  const documents: ActingLibraryDocument[] = [];

  for (const file of files) {
    const filePath = path.join(corpusDir, file.name);
    const ext = path.extname(file.name).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      if (UNSUPPORTED_MARKUP.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }
      continue;
    }

    const content = await loadFileContent(filePath, ext);
    const contentType = getContentType(ext);

    documents.push({
      sourceBook: file.name,
      content,
      contentType,
    });
  }

  return documents;
}

async function loadFileContent(
  filePath: string,
  ext: string
): Promise<string> {
  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    return extractTextFromPDF(buffer);
  }

  return fs.readFileSync(filePath, "utf-8");
}

function getContentType(ext: string): string {
  switch (ext) {
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
