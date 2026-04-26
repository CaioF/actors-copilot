import { ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

export function buildCoachPrompt(input: CoachPromptInput): string {
  const { actorBaseline, excerpts, question, history, auditions, auditionFullData } = input;

  const sections: string[] = [];

  sections.push(ACTING_COACH_SYSTEM_PROMPT);

  if (actorBaseline) {
    sections.push(`# ACTOR CONTEXT
${actorBaseline}`);
  }

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
