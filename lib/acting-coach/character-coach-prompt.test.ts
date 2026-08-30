import { buildCoachPrompt } from "./build-coach-prompt";
import { CHARACTER_COACH_SYSTEM_PROMPT, ACTING_COACH_SYSTEM_PROMPT } from "../prompts";
import type { CoachPromptInput } from "./contracts";

describe("Character Coach Prompt Generation", () => {
  it("uses CHARACTER_COACH_SYSTEM_PROMPT when coachType is 'character'", () => {
    const input: CoachPromptInput = {
      coachType: "character",
      question: "How do I start Stage 1?",
      excerpts: [],
    };

    const prompt = buildCoachPrompt(input);
    expect(prompt).toContain("CHARACTER COACH SYSTEM ROLE & PERSONA");
    expect(prompt).toContain("Tracey Collis");
    expect(prompt).toContain("THE 10-STAGE COACHING ARC & FLIGHT PLAN");
  });

  it("uses GENERAL ACTING COACH prompt when coachType is 'general'", () => {
    const input: CoachPromptInput = {
      coachType: "general",
      question: "What is sense memory?",
      excerpts: [],
    };

    const prompt = buildCoachPrompt(input);
    expect(prompt).not.toContain("CHARACTER COACH SYSTEM ROLE & PERSONA");
    expect(prompt).toContain(ACTING_COACH_SYSTEM_PROMPT.substring(0, 50));
  });

  it("injects exact sides text into prompt when available", () => {
    const input: CoachPromptInput = {
      coachType: "character",
      question: "What is my first line?",
      excerpts: [],
      auditionFullData: {
        sidesText: "JANE: I'm not going back there.\nMARK: You have to.",
      },
    };

    const prompt = buildCoachPrompt(input);
    expect(prompt).toContain("# EXACT SIDES TEXT (SINGLE SOURCE OF TRUTH FOR ALL DIALOGUE)");
    expect(prompt).toContain("JANE: I'm not going back there.");
    expect(prompt).toContain("MARK: You have to.");
  });

  it("injects flight plan stage state when provided in currentFocus", () => {
    const input: CoachPromptInput = {
      coachType: "character",
      question: "Take me to Stage 4",
      excerpts: [],
      currentFocus: {
        sessionFocus: "Actions and beats",
        stepIndex: 1,
        mode: "guided",
        phase: null,
        currentStage: 4,
        completedStages: [1, 2, 3],
        flightPlanMode: "guided",
      },
    };

    const prompt = buildCoachPrompt(input);
    expect(prompt).toContain("Current Flight Plan Stage: Stage 4");
    expect(prompt).toContain("Completed Stages: [1, 2, 3]");
    expect(prompt).toContain("Flight Plan Mode: guided");
  });
});
