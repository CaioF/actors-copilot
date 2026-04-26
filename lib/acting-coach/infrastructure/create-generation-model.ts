import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";
import { getApp } from "@/lib/firebase";
import { getActingCoachConfig } from "./config";

export function createGenerationModel() {
  const config = getActingCoachConfig();
  const ai = getAI(getApp(), {
    backend: new VertexAIBackend(),
  });
  return getGenerativeModel(ai, {
    model: config.generationModel,
  });
}
