import { ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

export function buildCoachPrompt(input: CoachPromptInput): string {
  const { actorBaseline, excerpts, question } = input;

  const sections: string[] = [];

  sections.push(ACTING_COACH_SYSTEM_PROMPT);

  if (actorBaseline) {
    sections.push(`# ACTOR CONTEXT
${actorBaseline}`);
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

  sections.push(`# ACTOR'S QUESTION
${question}`);

  return sections.join("\n\n");
}
