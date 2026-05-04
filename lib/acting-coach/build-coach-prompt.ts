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

    // Audition-level metadata that should travel with EVERY map (deadline, timezones,
    // casting director). The coach uses this to advise on pacing, time-pressure, and
    // who the actor is performing for — without this, advice like "rest tonight, tape
    // tomorrow morning" is impossible.
    const project = typeof auditionFullData.project === "string" ? auditionFullData.project : null;
    const role = typeof auditionFullData.role === "string" ? auditionFullData.role : null;
    const deadline = typeof auditionFullData.deadline === "string" ? auditionFullData.deadline : null;
    const auditionTimezone = typeof auditionFullData.auditionTimezone === "string" ? auditionFullData.auditionTimezone : null;
    const actorLocalDeadline = typeof auditionFullData.actorLocalDeadline === "string" ? auditionFullData.actorLocalDeadline : null;
    const castingDirectorName = typeof auditionFullData.castingDirectorName === "string" ? auditionFullData.castingDirectorName : null;

    const buildHeader = (): string => {
      const lines: string[] = [];
      if (project) lines.push(`Project: ${project}`);
      if (role) lines.push(`Role: ${role}`);
      if (deadline) {
        const tz = auditionTimezone ? ` (project tz: ${auditionTimezone})` : "";
        lines.push(`Deadline: ${deadline}${tz}`);
      }
      if (actorLocalDeadline) {
        lines.push(`Actor's local deadline: ${actorLocalDeadline}`);
      }
      if (castingDirectorName) {
        lines.push(`Casting Director: ${castingDirectorName}`);
      }
      return lines.join("\n");
    };

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

    const header = buildHeader();

    if (bothMapsPresent) {
      const sidesSection = renderMap(sidesMap ?? null, "SIDES BREAKDOWN");
      const briefSection = renderMap(briefMap ?? null, "BRIEF BREAKDOWN");
      sections.push(`${header}\n\n${sidesSection}\n\n${briefSection}`.trim());
    } else if (sidesPresent) {
      const mapLines = renderMap(sidesMap ?? null, "SIDES BREAKDOWN");
      if (mapLines) sections.push(`${header}\n\n${mapLines}`.trim());
    } else if (briefPresent) {
      const mapLines = renderMap(briefMap ?? null, "BRIEF BREAKDOWN");
      if (mapLines) sections.push(`${header}\n\n${mapLines}`.trim());
    } else if (legacyOnly) {
      const lines: string[] = [];
      if (legacyMap?.intro) lines.push(`\nOverview:\n${legacyMap.intro}`);
      if (legacyMap?.sections) {
        legacyMap.sections.forEach((sec) => {
          if (sec.title) lines.push(`\n### ${sec.title}`);
          if (sec.items) sec.items.forEach((item) => lines.push(`• ${item}`));
        });
      }
      if (legacyMap?.outro) lines.push(`\n${legacyMap.outro}`);
      sections.push(`# ACTIVE AUDITION BREAKDOWN\n${header}\n${lines.join("\n")}`.trim());
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