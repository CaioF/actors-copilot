import { Pinecone } from "@pinecone-database/pinecone";

// Model: "llama-text-embed-v2" — matches the index created with 1024 dimensions.
// The Pinecone Inference API uses "inputType" with values "query"/"passage".
export interface PineconeInferenceClient {
  embed(params: { model: string; inputs: string[]; taskType: string }): Promise<number[][]>;
}

export function createPineconeInferenceClient(config: { apiKey: string }): PineconeInferenceClient {
  const pinecone = new Pinecone({ apiKey: config.apiKey });
  return {
    async embed({ model, inputs, taskType }) {
      const inputType = taskType === "RETRIEVAL_QUERY" ? "query" : "passage";
      const result = await pinecone.inference.embed(model, inputs, { inputType });
      return (result.data ?? []).map((e) => e.values ?? []);
    },
  };
}
