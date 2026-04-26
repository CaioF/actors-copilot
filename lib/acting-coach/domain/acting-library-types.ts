export interface ActingLibraryDocument {
  sourceBook: string;
  content: string;
  contentType?: string;
}

export interface ChunkMetadata {
  sourceBook: string;
  chunkIndex: number;
  contentType: string;
  isTruncated?: boolean;
}

export interface ActingLibraryChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkOptions {
  chunkSize: number;
  overlapSize: number;
}
