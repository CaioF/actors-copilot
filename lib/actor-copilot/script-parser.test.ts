import {
  normalizeText,
  matchActorLine,
  getVoiceForCharacter,
  resolveGeminiVoice,
  AVAILABLE_GEMINI_VOICES,
  GEMINI_TTS_VOICE_IDS,
} from "./script-parser";

describe("script-parser utilities", () => {
  describe("normalizeText", () => {
    it("lowercases and strips punctuation and extra whitespace", () => {
      expect(normalizeText("  Where were YOU, John?!  ")).toBe("where were you john");
      expect(normalizeText("I told you I was working...")).toBe("i told you i was working");
    });
  });

  describe("matchActorLine", () => {
    it("matches exact text", () => {
      const result = matchActorLine("I told you I was working.", "I told you I was working.");
      expect(result.isMatch).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("matches with minor punctuation or capitalization differences", () => {
      const result = matchActorLine("Where were you?", "where were you");
      expect(result.isMatch).toBe(true);
    });

    it("matches fuzzy spoken lines with sufficient word overlap on final result", () => {
      const result = matchActorLine(
        "I told you I was working at the office until late.",
        "I told you I was working late",
        true
      );
      expect(result.isMatch).toBe(true);
    });

    it("does NOT match when actor has only spoken the first word or prefix of a line (interim or final)", () => {
      const result1 = matchActorLine(
        "Where were you last night when I called you five times?",
        "Where",
        false
      );
      expect(result1.isMatch).toBe(false);

      const result2 = matchActorLine(
        "Where were you last night when I called you five times?",
        "Where were you",
        false
      );
      expect(result2.isMatch).toBe(false);

      const result3 = matchActorLine(
        "Where were you last night when I called you five times?",
        "Where were you",
        true
      );
      expect(result3.isMatch).toBe(false);
    });
  });

  describe("getVoiceForCharacter", () => {
    it("returns pre-configured voice for known character names", () => {
      expect(getVoiceForCharacter("SARAH")).toBe("Aoede");
      expect(getVoiceForCharacter("JOHN")).toBe("Puck");
    });

    it("assigns fallback prebuilt voice for unmapped characters", () => {
      const voice1 = getVoiceForCharacter("DETECTIVE MILLER", 0);
      const voice2 = getVoiceForCharacter("OFFICER SMITH", 1);
      expect(typeof voice1).toBe("string");
      expect(typeof voice2).toBe("string");
      expect(voice1).not.toBe("");
    });

    it("keeps a stable voice rotation for unmapped characters", () => {
      expect(getVoiceForCharacter("DETECTIVE MILLER", 0)).toBe("Puck");
      expect(getVoiceForCharacter("OFFICER SMITH", 1)).toBe("Aoede");
      expect(getVoiceForCharacter("OFFICER SMITH", 2)).toBe("Fenrir");
    });

    it("never returns a voice that Gemini would reject", () => {
      const characters = ["ALEX", "NORA", "DETECTIVE MILLER", "MICHAEL"];
      characters.forEach((character, index) => {
        const voice = getVoiceForCharacter(character, index);
        expect(GEMINI_TTS_VOICE_IDS).toContain(voice);
      });
    });
  });

  describe("resolveGeminiVoice", () => {
    it("keeps a valid prebuilt voice", () => {
      expect(resolveGeminiVoice("Aoede")).toBe("Aoede");
      expect(resolveGeminiVoice("puck")).toBe("Puck");
    });

    it("falls back to a valid voice for unknown names", () => {
      // "Orpheus" is not a Gemini prebuilt voice, the API answers 400 for it.
      expect(resolveGeminiVoice("Orpheus")).toBe("Puck");
      expect(resolveGeminiVoice("")).toBe("Puck");
      expect(resolveGeminiVoice(undefined)).toBe("Puck");
    });

    it("only ever returns voices accepted by Gemini", () => {
      AVAILABLE_GEMINI_VOICES.forEach((voice) => {
        expect(GEMINI_TTS_VOICE_IDS).toContain(voice.id);
      });
    });
  });
});
