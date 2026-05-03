import PDFParser from "pdf2json";
import { logger } from "@/lib/logger";

export const PDF_TIMEOUT_MS = 60000;

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parsePromise = new Promise<string>((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on(
      "pdfParser_dataError",
      (errData: { parserError: Error | string }) => {
        reject(errData.parserError);
      }
    );

    pdfParser.on("pdfParser_dataReady", () => {
      const rawText = pdfParser.getRawTextContent();
      try {
        resolve(decodeURIComponent(rawText));
      } catch (error) {
        logger.warn({ err: error, msg: 'Failed to decode pdf text' });
        resolve(rawText);
      }
    });

    pdfParser.parseBuffer(buffer);
  });

  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(
      () => reject(new Error(`PDF parsing timeout exceeded (${PDF_TIMEOUT_MS / 1000}s).`)),
      PDF_TIMEOUT_MS
    )
  );

  return Promise.race([parsePromise, timeoutPromise]);
}
