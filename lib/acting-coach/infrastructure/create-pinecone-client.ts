import { Pinecone } from "@pinecone-database/pinecone";
import { getActingCoachConfig } from "./config";

export function createPineconeClient(): Pinecone {
  const config = getActingCoachConfig();
  return new Pinecone({
    apiKey: config.pineconeApiKey,
  });
}
