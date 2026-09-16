/**
 * Types and utilities for Actor Copilot script parsing, scene data, and rehearsal engine.
 * @module
 */

export interface ScriptLine {
  id: string;
  character: string;
  dialogue: string;
  order: number;
  emotionNote?: string;
}

export interface SceneData {
  sceneId: string;
  title: string;
  characters: string[];
  lines: ScriptLine[];
}

export type RehearsalStatus =
  | "IDLE"
  | "AI_READING"
  | "WAITING_FOR_ACTOR"
  | "ACTOR_RECORDING"
  | "TRANSCRIBING"
  | "MATCHING_LINE"
  | "FINISHED";

export interface RehearsalSessionState {
  auditionId?: string;
  scene: SceneData;
  actorCharacter: string;
  currentLineIndex: number;
  status: RehearsalStatus;
  userTranscripts: Record<number, string>; // order -> transcribed text spoken by actor
  isAiAudioPlaying: boolean;
  errorMessage?: string | null;
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: "male" | "female" | "neutral";
}

export const AVAILABLE_GEMINI_VOICES: VoiceOption[] = [
  { id: "Puck", name: "Puck", description: "Energetic & Direct (Male)", gender: "male" },
  { id: "Aoede", name: "Aoede", description: "Deep & Resonant (Female)", gender: "female" },
  { id: "Charon", name: "Charon", description: "Deep & Authoritative (Male)", gender: "male" },
  { id: "Kore", name: "Kore", description: "Warm & Clear (Female)", gender: "female" },
  { id: "Fenrir", name: "Fenrir", description: "Intense & Dramatic (Male)", gender: "male" },
  { id: "Leda", name: "Leda", description: "Calm & Soft (Female)", gender: "female" },
  { id: "Orpheus", name: "Orpheus", description: "Smooth & Melodic (Male)", gender: "male" },
];

/**
 * Normalizes text for fuzzy comparison by lowercasing and removing punctuation.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fuzzy matches what the actor said against the expected script line.
 * Uses word-set overlap and string length ratios for high-performance, robust matching.
 */
export function matchActorLine(
  expectedLine: string,
  actualTranscript: string
): { isMatch: boolean; score: number } {
  const normExpected = normalizeText(expectedLine);
  const normActual = normalizeText(actualTranscript);

  if (!normExpected || !normActual) {
    return { isMatch: true, score: 1.0 }; // Fail open for empty/short edge cases
  }

  if (normExpected === normActual) {
    return { isMatch: true, score: 1.0 };
  }

  const expectedWords = normExpected.split(" ");
  const actualWords = normActual.split(" ");

  const actualWordSet = new Set(actualWords);
  let matchedWordCount = 0;

  for (const word of expectedWords) {
    if (actualWordSet.has(word)) {
      matchedWordCount++;
    }
  }

  const wordScore = matchedWordCount / expectedWords.length;

  // If at least 35% of the expected words were spoken, count as a match for V1 rehearsal flow
  const isMatch = wordScore >= 0.35 || normExpected.includes(normActual) || normActual.includes(normExpected);

  return {
    isMatch,
    score: wordScore,
  };
}

/**
 * Default prebuilt voice mapping for AI characters.
 */
export const CHARACTER_VOICE_MAP: Record<string, string> = {
  default: "Puck",
  SARAH: "Aoede",
  JOHN: "Puck",
  MARK: "Fenrir",
  ELIZABETH: "Kore",
  DAVID: "Charon",
  AMANDA: "Leda",
  MICHAEL: "Orpheus",
};

/**
 * Returns a suitable voice for an AI character name.
 */
export function getVoiceForCharacter(characterName: string, index: number = 0): string {
  const upper = characterName.toUpperCase().trim();
  if (CHARACTER_VOICE_MAP[upper]) {
    return CHARACTER_VOICE_MAP[upper];
  }
  const voices = ["Puck", "Aoede", "Fenrir", "Kore", "Charon", "Leda", "Orpheus"];
  return voices[index % voices.length];
}
