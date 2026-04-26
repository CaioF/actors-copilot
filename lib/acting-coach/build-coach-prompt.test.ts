import { buildCoachPrompt } from "./build-coach-prompt";
import { CoachPromptInput, RetrievedExcerpt } from "./contracts";

describe("buildCoachPrompt", () => {
  describe("with all inputs provided", () => {
    const actorBaseline = "The actor has extensive training in Meisner technique and prefers emotional authenticity over intellectualization.";
    const excerpts: RetrievedExcerpt[] = [
      {
        citationNumber: 1,
        sourceBook: "Respect for Acting",
        excerptText: "Authenticity is the foundation of all compelling performance.",
        score: 0.92,
      },
      {
        citationNumber: 2,
        sourceBook: "Sanford Meisner on Acting",
        excerptText: "Living truthfully under imaginary circumstances is the actor's primary tool.",
        score: 0.89,
      },
    ];
    const question = "How do I approach emotional authenticity in auditions?";

    it("includes the coach system prompt", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toMatch(/acting coach/i);
    });

    it("includes the actor baseline summary", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toContain(actorBaseline);
    });

    it("includes all retrieved excerpts in order", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toContain("Authenticity is the foundation");
      expect(prompt).toContain("Living truthfully under imaginary circumstances");
    });

    it("includes the user question", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toContain(question);
    });

    it("composes sections in deterministic order", () => {
      const prompt1 = buildCoachPrompt({ actorBaseline, excerpts, question });
      const prompt2 = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt1).toBe(prompt2);
    });
  });

  describe("with no retrieved excerpts", () => {
    const actorBaseline = "The actor has extensive training in Meisner technique.";
    const question = "What is the best approach to cold reading?";

    it("omits the excerpt section entirely", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts: [], question });
      expect(prompt).not.toContain("Reference Material");
      expect(prompt).not.toContain("Source:");
      expect(prompt).not.toContain("Excerpt:");
    });

    it("still includes system prompt, baseline, and question", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts: [], question });
      expect(prompt).toMatch(/acting coach/i);
      expect(prompt).toContain(actorBaseline);
      expect(prompt).toContain(question);
    });
  });

  describe("excerpt ordering stability", () => {
    it("places excerpts in input order", () => {
      const excerpts: RetrievedExcerpt[] = [
        {
          citationNumber: 1,
          sourceBook: "Book A",
          excerptText: "First wisdom.",
          score: 0.95,
        },
        {
          citationNumber: 2,
          sourceBook: "Book B",
          excerptText: "Second insight.",
          score: 0.88,
        },
        {
          citationNumber: 3,
          sourceBook: "Book C",
          excerptText: "Third revelation.",
          score: 0.85,
        },
      ];
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts,
        question: "Test question?",
      });

      const firstIndex = prompt.indexOf("First wisdom.");
      const secondIndex = prompt.indexOf("Second insight.");
      const thirdIndex = prompt.indexOf("Third revelation.");

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe("with audition summaries", () => {
    const auditions = [
      { id: "aud-1", project: "FOUNDATION", role: "TECHNICIAN", createdAt: "2024-01-01" },
      { id: "aud-2", project: "Night Watch", role: "Lead", createdAt: "2024-02-15" },
    ];

    it("includes # ACTOR'S AUDITIONS section when auditions are present", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Which audition should I work on?",
        auditions,
      });
      expect(prompt).toContain("# ACTOR'S AUDITIONS");
      expect(prompt).toContain("FOUNDATION — TECHNICIAN (aud-1)");
      expect(prompt).toContain("Night Watch — Lead (aud-2)");
    });

    it("omits audition section when auditions is undefined", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "How do I prepare?",
        auditions: undefined,
      });
      expect(prompt).not.toContain("ACTOR'S AUDITIONS");
    });

    it("omits audition section when auditions is empty", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "How do I prepare?",
        auditions: [],
      });
      expect(prompt).not.toContain("ACTOR'S AUDITIONS");
    });
  });

  describe("with no actor baseline", () => {
    const excerpts: RetrievedExcerpt[] = [
      {
        citationNumber: 1,
        sourceBook: "Acting Books",
        excerptText: "Some acting wisdom.",
        score: 0.9,
      },
    ];
    const question = "How should I prepare for an audition?";

    it("still produces a valid prompt without baseline section", () => {
      const prompt = buildCoachPrompt({ actorBaseline: undefined, excerpts, question });
      expect(prompt).toMatch(/acting coach/i);
      expect(prompt).toContain(question);
      expect(prompt).toContain("Some acting wisdom.");
    });
  });

  describe("system prompt section headers", () => {
    it("contains ONE STEP AT A TIME section", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("ONE STEP AT A TIME");
    });

    it("contains MODES section", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("MODES");
    });

    it("contains EXAMPLES section", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("EXAMPLES");
    });

    it("contains guided mode example", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("## guided");
    });

    it("contains informational mode example", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("## informational");
    });

    it("contains transition mode example", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("## transition");
    });
  });

  describe("with currentFocus", () => {
    it("includes Session focus line when currentFocus.sessionFocus is truthy", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Find Jane's objective in scene 2",
          stepIndex: 2,
          mode: "guided",
          phase: "objective",
        },
      });
      expect(prompt).toContain("Session focus: Find Jane's objective in scene 2");
      expect(prompt).toContain("Step index: 2");
      expect(prompt).toContain("Mode: guided");
      expect(prompt).toContain("Phase: objective");
    });

    it("omits Session focus line when currentFocus is null", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: null,
      });
      expect(prompt).not.toContain("Session focus: Find");
    });

    it("omits Session focus line when currentFocus.sessionFocus is null", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: null,
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
      });
      expect(prompt).not.toContain("Session focus: Find");
    });

    it("omits Session focus line when currentFocus.sessionFocus is empty string", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "",
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
      });
      expect(prompt).not.toContain("Session focus: Find");
    });

    it("places Session focus line before # ACTOR'S QUESTION", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Find objective",
          stepIndex: 1,
          mode: "guided",
          phase: null,
        },
      });
      const focusLineIndex = prompt.indexOf("Session focus: Find objective");
      const questionIndex = prompt.indexOf("# ACTOR'S QUESTION");
      expect(focusLineIndex).toBeGreaterThan(0);
      expect(questionIndex).toBeGreaterThan(0);
      expect(focusLineIndex).toBeLessThan(questionIndex);
    });

    it("defaults mode to guided when mode is null", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Find objective",
          stepIndex: 0,
          mode: null,
          phase: null,
        },
      });
      expect(prompt).toContain("Mode: guided");
    });

    it("defaults phase to (none) when phase is null", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Find objective",
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
      });
      expect(prompt).toContain("Phase: (none)");
    });
  });
});
