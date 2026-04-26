import { loadCorpusDocuments } from "./load-corpus-documents";

jest.mock("fs", () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock("./extract-text-from-pdf", () => ({
  extractTextFromPDF: jest.fn(),
}));

const mockFs = jest.requireMock("fs") as {
  readdirSync: jest.Mock;
  readFileSync: jest.Mock;
  existsSync: jest.Mock;
};
const mockExtractTextFromPDF = jest.requireMock("./extract-text-from-pdf") as {
  extractTextFromPDF: jest.Mock;
};

describe("loadCorpusDocuments", () => {
  const fixturesDir = "/fake/fixtures/acting-library";

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
  });

  describe("supported file type filtering", () => {
    it("loads only .txt, .md, and .pdf files", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "sample-notes.txt", isFile: () => true },
        { name: "sample-outline.md", isFile: () => true },
        { name: "script.pdf", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      mockFs.readFileSync.mockReturnValue("test content");

      const documents = await loadCorpusDocuments(fixturesDir);

      expect(documents).toHaveLength(3);
      const loadedNames = documents.map((d) => d.sourceBook);
      expect(loadedNames).toContain("sample-notes.txt");
      expect(loadedNames).toContain("sample-outline.md");
      expect(loadedNames).toContain("script.pdf");
    });
  });

  describe("text/markdown source handling", () => {
    it("preserves source metadata for .txt files", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "acting-guide.txt", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      const txtContent = "Acting is reacting to other actors.";
      mockFs.readFileSync.mockReturnValue(txtContent);

      const documents = await loadCorpusDocuments(fixturesDir);

      expect(documents).toHaveLength(1);
      expect(documents[0].sourceBook).toBe("acting-guide.txt");
      expect(documents[0].content).toBe(txtContent);
      expect(documents[0].contentType).toBe("text/plain");
    });

    it("preserves source metadata for .md files", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "sample-outline.md", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      const mdContent = "# Acting Fundamentals\n\nSome markdown content.";
      mockFs.readFileSync.mockReturnValue(mdContent);

      const documents = await loadCorpusDocuments(fixturesDir);

      expect(documents).toHaveLength(1);
      expect(documents[0].sourceBook).toBe("sample-outline.md");
      expect(documents[0].content).toBe(mdContent);
      expect(documents[0].contentType).toBe("text/markdown");
    });

    it("returns documents in deterministic order matching filesystem order", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "zebra.txt", isFile: () => true },
        { name: "alpha.md", isFile: () => true },
        { name: "beta.pdf", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      mockFs.readFileSync.mockReturnValue("content");
      mockExtractTextFromPDF.extractTextFromPDF.mockResolvedValue("pdf content");

      const documents = await loadCorpusDocuments(fixturesDir);

      expect(documents[0].sourceBook).toBe("zebra.txt");
      expect(documents[1].sourceBook).toBe("alpha.md");
      expect(documents[2].sourceBook).toBe("beta.pdf");
    });
  });

  describe("PDF handling", () => {
    it("extracts text from PDF files using extractTextFromPDF", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "document.pdf", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      const pdfBuffer = Buffer.from("fake pdf buffer");
      mockFs.readFileSync.mockReturnValue(pdfBuffer);
      mockExtractTextFromPDF.extractTextFromPDF.mockResolvedValue(
        "PDF extracted text content"
      );

      const documents = await loadCorpusDocuments(fixturesDir);

      expect(
        mockExtractTextFromPDF.extractTextFromPDF
      ).toHaveBeenCalledWith(pdfBuffer);
      expect(documents).toHaveLength(1);
      expect(documents[0].sourceBook).toBe("document.pdf");
      expect(documents[0].content).toBe("PDF extracted text content");
      expect(documents[0].contentType).toBe("application/pdf");
    });
  });

  describe("unsupported file rejection", () => {
    it("rejects .doc files with descriptive error", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "notes.doc", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      await expect(loadCorpusDocuments(fixturesDir)).rejects.toThrow(
        "Unsupported file type: .doc"
      );
    });

    it("rejects .epub files with descriptive error", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "book.epub", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      await expect(loadCorpusDocuments(fixturesDir)).rejects.toThrow(
        "Unsupported file type: .epub"
      );
    });

    it("rejects .docx files with descriptive error", async () => {
      mockFs.readdirSync.mockReturnValue([
        { name: "document.docx", isFile: () => true },
      ] as unknown as import("fs").Dirent[]);

      await expect(loadCorpusDocuments(fixturesDir)).rejects.toThrow(
        "Unsupported file type: .docx"
      );
    });
  });

  describe("empty directory", () => {
    it("returns empty array when directory contains no supported files", async () => {
      mockFs.readdirSync.mockReturnValue([]);

      const documents = await loadCorpusDocuments(fixturesDir);
      expect(documents).toEqual([]);
    });
  });

  describe("directory existence", () => {
    it("throws descriptive error when corpus directory does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        loadCorpusDocuments("/nonexistent/path")
      ).rejects.toThrow(
        "Corpus directory does not exist: /nonexistent/path"
      );
    });
  });
});
