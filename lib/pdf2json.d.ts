/**
 * Type declarations for the pdf2json library.
 * This ensures TypeScript understands the class structure and methods.
 */
declare module 'pdf2json' {
    import { EventEmitter } from 'events';

    class PDFParser extends EventEmitter {
        /**
         * Initializes the PDF Parser.
         * @param context Context object (usually null for backend)
         * @param needRawText Set to 1 to extract raw text only
         */
        constructor(context?: any, needRawText?: number);

        /**
         * Parses a PDF from a memory buffer.
         * @param buffer The PDF file buffer
         */
        parseBuffer(buffer: Buffer): void;

        /**
         * Retrieves the extracted raw text after parsing is complete.
         */
        getRawTextContent(): string;
    }

    export default PDFParser;
}