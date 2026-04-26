import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";
import { getApp } from "@/lib/firebase";
import { EXTRACTION_TOOL } from "./extraction-tool-schema";
import type { ExtractedPsychData, ChatHistoryMessage } from "@/lib/chat-types";

export interface ExtractionInputs {
  content: string;
  history: ChatHistoryMessage[];
}

export async function runCoachTriggeredExtraction(
  inputs: ExtractionInputs
): Promise<ExtractedPsychData | null> {
  const { content, history } = inputs;
  const ai = getAI(getApp(), { backend: new VertexAIBackend() });
  const extractionModel = getGenerativeModel(ai, {
    model: "gemini-2.5-pro",
    generationConfig: { temperature: 0.1 },
    tools: [EXTRACTION_TOOL],
  });
  const recentHistoryText = history.slice(-7).map(
    (msg) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`
  ).join('\n');
  const promptForExtraction = `
            [SYSTEM INSTRUCTION FOR EXTRACTION]
            You are a silent psychological profiler. Analyze the conversation history and the actor's latest input.
            Task: Extract ONLY NEW, actionable psychological data, their core identity and defense mechanisms, and provide a holistic analysis. Do NOT extract if the actor is being repetitive, superficial, or making small talk. Your goal is to identify deep, novel insights into their soul and heart. 
            If the actor is making small talk, repeating previous points, or being superficial, set 'has_actionable_pattern' to false and leave the data arrays empty.
            Look at the broader context of the history to make holistic inferences.

            [CONVERSATION HISTORY]
            ${recentHistoryText}

            [LATEST ACTOR INPUT]
            "${content.trim()}"
        `;
  const result = await extractionModel.generateContent(promptForExtraction);
  const functionCalls = result.response.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    return functionCalls[0].args as unknown as ExtractedPsychData;
  }
  return null;
}
