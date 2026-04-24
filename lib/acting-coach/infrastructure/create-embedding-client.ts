import { GoogleGenAI } from "@google/genai";
import { getActingCoachConfig } from "./config";

export function createEmbeddingClient(): GoogleGenAI {
  const config = getActingCoachConfig();
  return new GoogleGenAI({
    vertexai: true,
    project: config.googleCloudProject,
    location: config.googleCloudLocation,
  });
}
