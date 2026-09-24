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
  | "HANDS_FREE_LISTENING"
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
 * Evaluates whether the actor has completed speaking their expected line.
 */
export function matchActorLine(
  expectedLine: string,
  actualTranscript: string,
  isFinalResult: boolean = false
): { isMatch: boolean; score: number } {
  const normExpected = normalizeText(expectedLine);
  const normActual = normalizeText(actualTranscript);

  if (!normExpected || !normActual) {
    return { isMatch: false, score: 0 };
  }

  if (normExpected === normActual) {
    return { isMatch: true, score: 1.0 };
  }

  // If actual transcript fully contains the expected line (actor said whole line plus extra)
  if (normActual.includes(normExpected)) {
    return { isMatch: true, score: 1.0 };
  }

  const expectedWords = normExpected.split(" ").filter(Boolean);
  const actualWords = normActual.split(" ").filter(Boolean);

  if (expectedWords.length === 0 || actualWords.length === 0) {
    return { isMatch: false, score: 0 };
  }

  const actualWordSet = new Set(actualWords);
  let matchedWordCount = 0;

  for (const word of expectedWords) {
    if (actualWordSet.has(word)) {
      matchedWordCount++;
    }
  }

  const wordScore = matchedWordCount / expectedWords.length;

  // Check if the actor spoke the end of the line (final expected word appears in the last 3 spoken words)
  const lastExpectedWord = expectedWords[expectedWords.length - 1];
  const lastSpokenWords = actualWords.slice(-3);
  const spokenEndMatch = lastExpectedWord ? lastSpokenWords.includes(lastExpectedWord) : false;

  // If this is interim streaming speech (actor is actively talking mid-sentence),
  // require near-complete word coverage (>= 88%) or (>= 75% + end word) to avoid mid-sentence cutoffs.
  if (!isFinalResult) {
    const isInterimMatch = wordScore >= 0.88 || (wordScore >= 0.75 && spokenEndMatch);
    return { isMatch: isInterimMatch, score: wordScore };
  }

  // Short lines (1-3 words)
  if (expectedWords.length <= 3) {
    const isMatch = wordScore >= 0.66 || spokenEndMatch;
    return { isMatch, score: wordScore };
  }

  // Medium to long lines (final result / pause):
  // Match if high word overlap (>= 75%) OR (word score >= 60% AND end of line was spoken)
  const isMatch = wordScore >= 0.75 || (wordScore >= 0.60 && spokenEndMatch);

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
