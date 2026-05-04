import { ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

/**
 * Constructs the final prompt string for the Acting Coach AI by aggregating system instructions,
 * the actor's specific identity and context, relevant vector database excerpts, and conversation history.
 * * This version includes session focus and audition-specific performance maps to ensure
 * high-context coaching responses.
 *
 * @param {CoachPromptInput} input - The aggregated context data required to build the prompt.
 * @returns {string} The fully assembled prompt string ready to be sent to the generation model.
 */
export function buildCoachPrompt(input: CoachPromptInput): string {
  const { 
    actorName, 
    actorBaseline,
    actorProfile,
    excerpts, 
    question, 
    history, 
    auditions, 
    auditionFullData,
    currentFocus // Added to maintain session continuity
  } = input;

  const sections: string[] = [];

  // 1. Core System Persona & Instructions
  sections.push(ACTING_COACH_SYSTEM_PROMPT);

  // 2. Dynamic Actor Identity Injection
  if (actorName) {
    sections.push(`# CURRENT ACTOR\nYou are coaching: ${actorName}. Always address them by this name and utilize their specific DNA context provided below.`);
  }

  // 3. Actor DNA / Baseline Context
  if (actorBaseline) {
    sections.push(`# ACTOR DNA & PSYCHOLOGY\n${actorBaseline}`);
  }

  // 3b. Actor Public Profile
  if (actorProfile) {
    sections.push(`# ACTOR PUBLIC PROFILE\n${actorProfile}`);
  }

  // 4. Current Session Focus
  if (currentFocus?.sessionFocus) {
    sections.push(`Session focus: ${currentFocus.sessionFocus}`);
    sections.push(`Step index: ${currentFocus.stepIndex ?? 0}`);
    sections.push(`Mode: ${currentFocus.mode ?? "guided"}`);
    sections.push(`Phase: ${currentFocus.phase ?? "(none)"}`);
  }

  // 5. Current Audition Focus (Performance Map Integration)
  if (auditionFullData) {
    type PerformanceMap = {
      intro?: string;
      sections?: Array<{ title?: string; items?: string[] }>;
      outro?: string;
    };

    const hasSides = auditionFullData.hasSides as boolean | undefined;
    const hasBrief = auditionFullData.hasBrief as boolean | undefined;
    const sidesMap = auditionFullData.sidesPerformanceMap as PerformanceMap | null | undefined;
    const briefMap = auditionFullData.briefPerformanceMap as PerformanceMap | null | undefined;
    const legacyMap = auditionFullData.performanceMap as PerformanceMap | null | undefined;

    const renderMap = (pm: PerformanceMap | null | undefined, label: string): string => {
      const lines: string[] = [];
      if (pm?.intro) lines.push(`Overview:\n${pm.intro}`);
      if (pm?.sections) {
        pm.sections.forEach((sec) => {
          if (sec.title) lines.push(`### ${sec.title}`);
          if (sec.items) sec.items.forEach((item) => lines.push(`• ${item}`));
        });
      }
      if (pm?.outro) lines.push(`${pm.outro}`);
      if (lines.length === 0) return "";
      return `# ACTIVE AUDITION BREAKDOWN\n# ${label}\n${lines.join("\n")}`;
    };

    const sidesPresent = hasSides === true || (hasSides === undefined && sidesMap);
    const briefPresent = hasBrief === true || (hasBrief === undefined && briefMap);

    const bothMapsPresent = sidesPresent && briefPresent;
    const legacyOnly = !bothMapsPresent && legacyMap;

    if (bothMapsPresent) {
      const projectLine = typeof auditionFullData.project === "string"
        ? `Project: ${auditionFullData.project}`
        : "";
      const roleLine = typeof auditionFullData.role === "string"
        ? `Role: ${auditionFullData.role}`
        : "";
      const header = [projectLine, roleLine].filter(Boolean).join("\n");

      const sidesSection = renderMap(sidesMap ?? null, "SIDES BREAKDOWN");
      const briefSection = renderMap(briefMap ?? null, "BRIEF BREAKDOWN");

      sections.push(`${header}\n\n${sidesSection}\n\n${briefSection}`.trim());
    } else if (sidesPresent) {
      const lines: string[] = [];
      if (typeof auditionFullData.project === "string") lines.push(`Project: ${auditionFullData.project}`);
      if (typeof auditionFullData.role === "string") lines.push(`Role: ${auditionFullData.role}`);
      const mapLines = renderMap(sidesMap ?? null, "SIDES BREAKDOWN");
      if (mapLines) sections.push(`${lines.join("\n")}\n\n${mapLines}`);
    } else if (briefPresent) {
      const lines: string[] = [];
      if (typeof auditionFullData.project === "string") lines.push(`Project: ${auditionFullData.project}`);
      if (typeof auditionFullData.role === "string") lines.push(`Role: ${auditionFullData.role}`);
      const mapLines = renderMap(briefMap ?? null, "BRIEF BREAKDOWN");
      if (mapLines) sections.push(`${lines.join("\n")}\n\n${mapLines}`);
    } else if (legacyOnly) {
      const lines: string[] = [];
      if (typeof auditionFullData.project === "string") lines.push(`Project: ${auditionFullData.project}`);
      if (typeof auditionFullData.role === "string") lines.push(`Role: ${auditionFullData.role}`);

      if (legacyMap?.intro) lines.push(`\nOverview:\n${legacyMap.intro}`);
      if (legacyMap?.sections) {
        legacyMap.sections.forEach((sec) => {
          if (sec.title) lines.push(`\n### ${sec.title}`);
          if (sec.items) sec.items.forEach((item) => lines.push(`• ${item}`));
        });
      }
      if (legacyMap?.outro) lines.push(`\n${legacyMap.outro}`);

      sections.push(`# ACTIVE AUDITION BREAKDOWN\n${lines.join("\n")}`);
    }
  }

  // 6. Historical Auditions Summary
  if (auditions && auditions.length > 0) {
    const auditionLines = auditions.map(
      (a) => `- ${a.project} — ${a.role} (${a.id})` 
    );
    sections.push(`# ACTOR'S AUDITIONS\n${auditionLines.join("\n")}`);
  }

  // 7. Vector Database Retrieval (RAG)
  if (excerpts.length > 0) {
    const excerptSection = excerpts
      .map((excerpt: RetrievedExcerpt) => {
        return `[Source: ${excerpt.sourceBook}] [Citation: ${excerpt.citationNumber}]\n"${excerpt.excerptText}"`;
      })
      .join("\n\n");

    sections.push(`# METHODOLOGY REFERENCE MATERIAL\nUse the following acting methodology excerpts to ground your coaching advice:\n\n${excerptSection}`);
  }

  // 8. Conversation History
  if (history && history.length > 0) {
    const historySection = history
      .map((msg) => `${msg.role === "user" ? "Actor" : "Coach"}: ${msg.content}`)
      .join("\n");
    sections.push(`# CONVERSATION LOG\n${historySection}`);
  }

  // 9. The Current Query
  sections.push(`# ACTOR'S CURRENT REQUEST\n${question}`);

  return sections.join("\n\n");
}