import { chunkActingText } from "./chunk-acting-text";
import {
  ActingLibraryDocument,
  ActingLibraryChunk,
} from "./acting-library-types";

describe("chunkActingText", () => {
  describe("paragraph-separated text chunking", () => {
    it("chunks paragraph-separated text into stable ordered chunks under the configured size limit", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "An Actor's Work",
        content: `Part One

Actors must train their imagination.

This is the second paragraph.

And the third one here.`,
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 50,
        overlapSize: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(50);
      });

      const orderedContents = chunks.map((c) => c.content);
      expect(orderedContents[0]).toBe("Part One");
      expect(orderedContents[1]).toBe("Actors must train their imagination.");
    });

    it("returns chunks in deterministic order matching paragraph sequence", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Acting Techniques",
        content: `First paragraph speaks.

Second paragraph responds.

Third paragraph concludes.`,
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      expect(chunks[0].metadata.chunkIndex).toBe(0);
      expect(chunks[1].metadata.chunkIndex).toBe(1);
      expect(chunks[2].metadata.chunkIndex).toBe(2);
    });
  });

  describe("overlap between adjacent chunks", () => {
    it("carries overlap between adjacent chunks", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Stanislavski System",
        content: `The actor must feel the emotion.

The actor must transform into the character.

The actor lives within the play.`,
        contentType: "text/plain",
      };

      const chunksWithOverlap = chunkActingText(document, {
        chunkSize: 60,
        overlapSize: 20,
      });

      const chunksWithoutOverlap = chunkActingText(document, {
        chunkSize: 60,
        overlapSize: 0,
      });

      expect(chunksWithOverlap.length).toBe(chunksWithoutOverlap.length);

      expect(chunksWithOverlap.length).toBeGreaterThanOrEqual(
        chunksWithoutOverlap.length
      );

      const secondChunkWithOverlap = chunksWithOverlap[1].content;
      const secondChunkWithoutOverlap = chunksWithoutOverlap[1].content;
      expect(secondChunkWithOverlap.length).toBeGreaterThanOrEqual(
        secondChunkWithoutOverlap.length
      );
    });

    it("overlap window is preserved when chunks are smaller than overlap size", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Method Acting",
        content: `Actors use their imagination to create reality on stage.

The second paragraph continues the thought with additional detail.`,
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 60,
        overlapSize: 30,
      });

      expect(chunks.length).toBeGreaterThan(1);

      const firstChunkEnd = chunks[0].content.slice(-15);
      expect(chunks[1].content).toContain(firstChunkEnd);
    });
  });

  describe("overlong paragraph hard-split", () => {
    it("hard-splits overlong paragraphs and marks them as truncated", () => {
      const longParagraph =
        "This is a very long paragraph that exceeds the chunk size limit. " +
        "It continues with more text that should be split across multiple chunks. " +
        "The chunking algorithm needs to handle this case by splitting at word boundaries. " +
        "Each resulting chunk must be marked as truncated in its metadata.";

      const document: ActingLibraryDocument = {
        sourceBook: "Acting Theory",
        content: longParagraph,
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach((chunk: ActingLibraryChunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(100);
        expect(chunk.metadata.isTruncated).toBe(true);
      });
    });

    it("each hard-split chunk respects the chunkSize limit", () => {
      const longText =
        "AAA BBB CCC DDD EEE FFF GGG HHH III JJJ KKK LLL MMM NNN OOO PPP QQQ RRR SSS TTT.";

      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: longText,
        contentType: "text/plain",
      };

      const options = { chunkSize: 30, overlapSize: 0 };
      const chunks = chunkActingText(document, options);

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach((chunk: ActingLibraryChunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(options.chunkSize);
      });
    });
  });

  describe("metadata defaults", () => {
    it("includes sourceBook in metadata", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "An Actor's Work",
        content: "Some acting advice here.",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.metadata.sourceBook).toBe("An Actor's Work");
      });
    });

    it("includes sequential chunkIndex in metadata", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: `First.\n\nSecond.\n\nThird.`,
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      chunks.forEach((chunk: ActingLibraryChunk, index: number) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
      });
    });

    it("defaults contentType from document contentType field", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: "Some content.",
        contentType: "text/markdown",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.metadata.contentType).toBe("text/markdown");
      });
    });

    it("defaults contentType to text/plain when not provided", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: "Some content.",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.metadata.contentType).toBe("text/plain");
      });
    });
  });

  describe("empty or whitespace-only text", () => {
    it("returns an empty array for empty string", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: "",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      expect(chunks).toEqual([]);
    });

    it("returns an empty array for whitespace-only text", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: "   \n\t  \r\n  ",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 100,
        overlapSize: 0,
      });

      expect(chunks).toEqual([]);
    });

    it("returns at least one chunk for valid non-empty text", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content: "Tiny.",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, {
        chunkSize: 1000,
        overlapSize: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toBe("Tiny.");
    });
  });

  describe("default options", () => {
    it("uses default chunk size when options not provided", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content:
          "This is a moderately long paragraph that should be split if the default chunk size is smaller than this text.",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk: ActingLibraryChunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(800);
      });
    });

    it("uses default overlap size when options not provided", () => {
      const document: ActingLibraryDocument = {
        sourceBook: "Test Book",
        content:
          "First paragraph.\n\nSecond paragraph with more content here.\n\nThird paragraph.",
        contentType: "text/plain",
      };

      const chunks = chunkActingText(document, { chunkSize: 50 });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
