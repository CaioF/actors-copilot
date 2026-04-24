import {
  ActingLibraryChunk,
  ActingLibraryDocument,
  ChunkOptions,
} from "./acting-library-types";

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP_SIZE = 100;

function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

function splitIntoParagraphs(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const line of lines) {
    if (isBlankLine(line)) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join("\n"));
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(line);
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join("\n"));
  }

  return paragraphs;
}

function hardSplitParagraph(
  text: string,
  maxSize: number
): { chunk: string; remainder: string } {
  const words = text.split(" ");
  let chunk = "";
  let remainder = "";

  for (const word of words) {
    if ((chunk + " " + word).trim().length <= maxSize) {
      chunk = (chunk + " " + word).trim();
    } else {
      remainder = [remainder, word].filter(Boolean).join(" ");
      break;
    }
  }

  if (remainder) {
    const remainingWords = text.slice(chunk.length).trim().split(/\s+/);
    remainder = remainingWords.join(" ");
  }

  return { chunk, remainder };
}

function isWhitespaceOnly(text: string): boolean {
  return text.trim() === "";
}

export function chunkActingText(
  document: ActingLibraryDocument,
  options?: Partial<ChunkOptions>
): ActingLibraryChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlapSize = options?.overlapSize ?? DEFAULT_OVERLAP_SIZE;

  const { content, sourceBook, contentType } = document;

  if (isWhitespaceOnly(content)) {
    return [];
  }

  const paragraphs = splitIntoParagraphs(content);
  const chunks: ActingLibraryChunk[] = [];
  let chunkIndex = 0;
  let priorChunkText: string | null = null;

  for (const paragraph of paragraphs) {
    if (isWhitespaceOnly(paragraph)) {
      continue;
    }

    if (paragraph.length <= chunkSize) {
      let chunkContent = paragraph;

      if (priorChunkText && overlapSize > 0) {
        const overlapText = priorChunkText.slice(-overlapSize);
        if (!chunkContent.startsWith(overlapText)) {
          chunkContent = overlapText + "\n" + chunkContent;
        }
      }

      chunks.push({
        content: chunkContent,
        metadata: {
          sourceBook,
          chunkIndex,
          contentType: contentType ?? "text/plain",
          isTruncated: false,
        },
      });

      priorChunkText = chunkContent;
      chunkIndex++;
    } else {
      let remainder = paragraph;

      while (remainder.length > 0) {
        const { chunk: hardChunk, remainder: newRemainder } = hardSplitParagraph(
          remainder,
          chunkSize
        );

        let chunkContent = hardChunk;

        if (priorChunkText && overlapSize > 0) {
          const overlapText = priorChunkText.slice(-overlapSize);
          if (!chunkContent.startsWith(overlapText)) {
            chunkContent = overlapText + "\n" + chunkContent;
          }
        }

        chunks.push({
          content: chunkContent,
          metadata: {
            sourceBook,
            chunkIndex,
            contentType: contentType ?? "text/plain",
            isTruncated: true,
          },
        });

        priorChunkText = chunkContent;
        chunkIndex++;
        remainder = newRemainder;
      }
    }
  }

  return chunks;
}
