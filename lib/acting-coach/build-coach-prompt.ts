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

  // 4. Current Session Focus
  if (currentFocus?.sessionFocus) {
    sections.push(`Session focus: ${currentFocus.sessionFocus}`);
    sections.push(`Step index: ${currentFocus.stepIndex ?? 0}`);
    sections.push(`Mode: ${currentFocus.mode ?? "guided"}`);
    sections.push(`Phase: ${currentFocus.phase ?? "(none)"}`);
  }

  // 5. Current Audition Focus (Performance Map Integration)
  if (auditionFullData) {
    const pm = auditionFullData.performanceMap as {
      intro?: string;
      sections?: Array<{ title?: string; items?: string[] }>;
      outro?: string;
    } | undefined;
    
    const lines: string[] = [];
    if (typeof auditionFullData.project === "string") lines.push(`Project: ${auditionFullData.project}`);
    if (typeof auditionFullData.role === "string") lines.push(`Role: ${auditionFullData.role}`);
    
    if (pm?.intro) lines.push(`\nOverview:\n${pm.intro}`);
    if (pm?.sections) {
      pm.sections.forEach((sec) => {
        if (sec.title) lines.push(`\n### ${sec.title}`);
        if (sec.items) sec.items.forEach((item) => lines.push(`• ${item}`));
      });
    }
    if (pm?.outro) lines.push(`\n${pm.outro}`);
    
    sections.push(`# ACTIVE AUDITION BREAKDOWN\n${lines.join("\n")}`);
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