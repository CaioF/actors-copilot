import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";
import { getApp } from "@/lib/firebase";
import { getActingCoachConfig } from "./config";

export function createGenerationModel(opts?: { generationConfig?: Record<string, unknown> }) {
  const config = getActingCoachConfig();
  const ai = getAI(getApp(), {
    backend: new VertexAIBackend('global'),
  });
  return getGenerativeModel(ai, {
    model: config.generationModel,
    ...(opts?.generationConfig ? { generationConfig: opts.generationConfig } : {}),
  });
}
