import { ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

export function buildCoachPrompt(input: CoachPromptInput): string {
  const { actorBaseline, excerpts, question, history, auditions } = input;

  const sections: string[] = [];

  sections.push(ACTING_COACH_SYSTEM_PROMPT);

  if (actorBaseline) {
    sections.push(`# ACTOR CONTEXT
${actorBaseline}`);
  }

  if (auditions && auditions.length > 0) {
    const auditionLines = auditions.map(
      (a) => `- ${a.project} — ${a.role} (${a.id})`
    );
    sections.push(`# ACTOR'S AUDITIONS\n${auditionLines.join("\n")}`);
  }

  if (excerpts.length > 0) {
    const excerptSection = excerpts
      .map((excerpt: RetrievedExcerpt) => {
        return `[${excerpt.citationNumber}] "${excerpt.excerptText}"
Source: ${excerpt.sourceBook}`;
      })
      .join("\n\n");

    sections.push(`# REFERENCE MATERIAL
${excerptSection}`);
  }

  if (history && history.length > 0) {
    const historySection = history
      .map((msg) => `${msg.role === "user" ? "Actor" : "Coach"}: ${msg.content}`)
      .join("\n");
    sections.push(`# CONVERSATION HISTORY\n${historySection}`);
  }

  sections.push(`# ACTOR'S QUESTION
${question}`);

  return sections.join("\n\n");
}
