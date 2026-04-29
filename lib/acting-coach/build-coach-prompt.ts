import { ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

/**
 * Constructs the final prompt string for the Acting Coach AI by aggregating system instructions,
 * the actor's specific identity and context, relevant vector database excerpts, and conversation history.
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
    auditionFullData 
  } = input;

  const sections: string[] = [];

  // Core System Persona & Instructions
  sections.push(ACTING_COACH_SYSTEM_PROMPT);

  // Dynamic Actor Identity Injection
  if (actorName) {
    sections.push(`# CURRENT ACTOR\nYou are coaching: ${actorName}. Always address them by this name and use their specific DNA context below.`);
  }

  // Actor DNA / Baseline Context
  if (actorBaseline) {
    sections.push(`# ACTOR CONTEXT\n${actorBaseline}`);
  }

  // Current Audition Focus (if applicable)
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
    
    sections.push(`# AUDITION BREAKDOWN\n${lines.join("\n")}`);
  }

  //  Historical Auditions Summary
  if (auditions && auditions.length > 0) {
    const auditionLines = auditions.map(
      (a) => `- ${a.project} — ${a.role} (${a.id})`
    );
    sections.push(`# ACTOR'S AUDITIONS\n${auditionLines.join("\n")}`);
  }

  //  Vector Database Retrieval (RAG)
  if (excerpts.length > 0) {
    const excerptSection = excerpts
      .map((excerpt: RetrievedExcerpt) => {
        return `[${excerpt.citationNumber}] "${excerpt.excerptText}"\nSource: ${excerpt.sourceBook}`;
      })
      .join("\n\n");

    sections.push(`# REFERENCE MATERIAL\n${excerptSection}`);
  }

  // Conversation History
  if (history && history.length > 0) {
    const historySection = history
      .map((msg) => `${msg.role === "user" ? "Actor" : "Coach"}: ${msg.content}`)
      .join("\n");
    sections.push(`# CONVERSATION HISTORY\n${historySection}`);
  }

  // The Current Query
  sections.push(`# ACTOR'S QUESTION\n${question}`);

  return sections.join("\n\n");
}