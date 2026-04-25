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
      expect(prompt).toContain("Acting Coach");
    });

    it("includes the actor baseline summary", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toContain(actorBaseline);
    });

    it("includes all retrieved excerpts in order", () => {
      const prompt = buildCoachPrompt({ actorBaseline, excerpts, question });
      expect(prompt).toContain("Respect for Acting");
      expect(prompt).toContain("Authenticity is the foundation");
      expect(prompt).toContain("Sanford Meisner on Acting");
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
      expect(prompt).toContain("Acting Coach");
      expect(prompt).toContain(actorBaseline);
      expect(prompt).toContain(question);
    });
  });

  describe("excerpt numbering stability", () => {
    it("prefixes each excerpt with stable citation markers in 1..N order", () => {
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

      const bookAIndex = prompt.indexOf("Book A");
      const bookBIndex = prompt.indexOf("Book B");
      const bookCIndex = prompt.indexOf("Book C");

      expect(bookAIndex).toBeLessThan(bookBIndex);
      expect(bookBIndex).toBeLessThan(bookCIndex);
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
      expect(prompt).toContain("Acting Coach");
      expect(prompt).toContain(question);
      expect(prompt).toContain("Acting Books");
    });
  });
});
