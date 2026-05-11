import { buildCoachPrompt } from "./build-coach-prompt";
import { CoachPromptInput, RetrievedExcerpt, AuditionSummary } from "./contracts";
import type { CriticalBriefFact } from "@/lib/audition-types";

describe("buildCoachPrompt", () => {
  describe("Initialization & Basic Functionality", () => {
    it("returns a non-empty string", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
      });
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("includes the system prompt from ACTING_COACH_SYSTEM_PROMPT", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toMatch(/acting coach/i);
    });

    it("always includes the actor's current request section", () => {
      const question = "How do I approach emotional authenticity in auditions?";
      const prompt = buildCoachPrompt({
        excerpts: [],
        question,
      });
      expect(prompt).toContain("# ACTOR'S CURRENT REQUEST");
      expect(prompt).toContain(question);
    });

    it("composes sections in deterministic order", () => {
      const input: CoachPromptInput = {
        actorBaseline: "Test baseline",
        excerpts: [],
        question: "Test question?",
      };
      const prompt1 = buildCoachPrompt(input);
      const prompt2 = buildCoachPrompt(input);
      expect(prompt1).toBe(prompt2);
    });
  });

  describe("Actor Identity Section", () => {
    it("includes actor name section when actorName is provided", () => {
      const prompt = buildCoachPrompt({
        actorName: "Jane Doe",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("# CURRENT ACTOR");
      expect(prompt).toContain("Jane Doe");
    });

    it("omits actor name section when actorName is undefined", () => {
      const prompt = buildCoachPrompt({
        actorName: undefined,
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).not.toContain("# CURRENT ACTOR");
    });
  });

  describe("Actor Baseline Section", () => {
    const baseline = "The actor has extensive training in Meisner technique and prefers emotional authenticity over intellectualization.";

    it("includes actorProfile when provided as a string", () => {
      const actorProfileJson = JSON.stringify({ bio: "UNIQUE_ACTOR_PROFILE_DATA_MARKER_98765", credits: [] }, null, 2);
      const prompt = buildCoachPrompt({
        actorProfile: actorProfileJson,
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("# ACTOR PUBLIC PROFILE");
      expect(prompt).toContain("UNIQUE_ACTOR_PROFILE_DATA_MARKER_98765");
    });

    it("omits actorProfile data when actorProfile is undefined", () => {
      const prompt = buildCoachPrompt({
        actorProfile: undefined,
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).not.toContain("UNIQUE_ACTOR_PROFILE_DATA_MARKER_98765");
    });

    it("omits actorProfile data when actorProfile is empty string", () => {
      const prompt = buildCoachPrompt({
        actorProfile: "",
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).not.toContain("UNIQUE_ACTOR_PROFILE_DATA_MARKER_98765");
    });

    it("includes actor baseline when provided", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: baseline,
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).toContain("# ACTOR DNA & PSYCHOLOGY");
      expect(prompt).toContain(baseline);
    });

    it("omits baseline section when actorBaseline is undefined", () => {
      const prompt = buildCoachPrompt({
        actorBaseline: undefined,
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).not.toContain("# ACTOR DNA & PSYCHOLOGY");
    });
  });

  describe("Excerpts Section", () => {
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

    it("includes all excerpts with citations when provided", () => {
      const prompt = buildCoachPrompt({
        excerpts,
        question: "Test question?",
      });
      expect(prompt).toContain("# METHODOLOGY REFERENCE MATERIAL");
      expect(prompt).toContain("Authenticity is the foundation of all compelling performance.");
      expect(prompt).toContain("Living truthfully under imaginary circumstances is the actor's primary tool.");
      expect(prompt).toContain("Citation: 1");
      expect(prompt).toContain("Citation: 2");
    });

    it("includes source books in excerpt references", () => {
      const prompt = buildCoachPrompt({
        excerpts,
        question: "Test question?",
      });
      expect(prompt).toContain("Respect for Acting");
      expect(prompt).toContain("Sanford Meisner on Acting");
    });

    it("omits excerpt section entirely when excerpts array is empty", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
      });
      expect(prompt).not.toContain("# METHODOLOGY REFERENCE MATERIAL");
    });

    it("maintains excerpt ordering from input", () => {
      const orderedExcerpts: RetrievedExcerpt[] = [
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
        excerpts: orderedExcerpts,
        question: "Test question?",
      });

      const firstIndex = prompt.indexOf("First wisdom.");
      const secondIndex = prompt.indexOf("Second insight.");
      const thirdIndex = prompt.indexOf("Third revelation.");

      expect(firstIndex).toBeGreaterThan(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(thirdIndex).toBeGreaterThan(secondIndex);
    });
  });

  describe("Auditions Section", () => {
    const auditions: AuditionSummary[] = [
      { id: "aud-1", project: "FOUNDATION", role: "TECHNICIAN", createdAt: "2024-01-01" },
      { id: "aud-2", project: "Night Watch", role: "Lead", createdAt: "2024-02-15" },
    ];

    it("includes ACTOR'S AUDITIONS section when auditions array has items", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Which audition should I work on?",
        auditions,
      });
      expect(prompt).toContain("# ACTOR'S AUDITIONS");
      expect(prompt).toContain("FOUNDATION — TECHNICIAN (aud-1)");
      expect(prompt).toContain("Night Watch — Lead (aud-2)");
    });

    it("omits auditions section when auditions is undefined", () => {
      const prompt = buildCoachPrompt({
        auditions: undefined,
        excerpts: [],
        question: "How do I prepare?",
      });
      expect(prompt).not.toContain("# ACTOR'S AUDITIONS");
    });

    it("omits auditions section when auditions array is empty", () => {
      const prompt = buildCoachPrompt({
        auditions: [],
        excerpts: [],
        question: "How do I prepare?",
      });
      expect(prompt).not.toContain("# ACTOR'S AUDITIONS");
    });

    it("formats each audition with project, role, and id", () => {
      const prompt = buildCoachPrompt({
        auditions: [
          { id: "test-123", project: "TestProject", role: "TestRole", createdAt: "2024-01-01" },
        ],
        excerpts: [],
        question: "Test?",
      });
      expect(prompt).toContain("TestProject — TestRole (test-123)");
    });
  });

  describe("Session Focus Section", () => {
    it("includes all focus fields when currentFocus is provided with sessionFocus", () => {
      const prompt = buildCoachPrompt({
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

    it("omits session focus section when currentFocus is null", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        currentFocus: null,
      });
      expect(prompt).not.toContain("Session focus:");
    });

    it("omits session focus section when sessionFocus property is null", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: null,
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
      });
      expect(prompt).not.toContain("Session focus:");
    });

    it("omits session focus section when sessionFocus is empty string", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "",
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
      });
      expect(prompt).not.toContain("Session focus:");
    });

    it("defaults mode to 'guided' when mode is null", () => {
      const prompt = buildCoachPrompt({
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

    it("defaults phase to '(none)' when phase is null", () => {
      const prompt = buildCoachPrompt({
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

    it("places session focus before ACTOR'S CURRENT REQUEST section", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Find objective",
          stepIndex: 1,
          mode: "guided",
          phase: null,
        },
      });
      const focusIndex = prompt.indexOf("Session focus: Find objective");
      const questionIndex = prompt.indexOf("# ACTOR'S CURRENT REQUEST");
      expect(focusIndex).toBeGreaterThan(0);
      expect(questionIndex).toBeGreaterThan(focusIndex);
    });
  });

  describe("Conversation History Section", () => {
    it("includes conversation history when provided", () => {
      const history = [
        { role: "user" as const, content: "What should I do?" },
        { role: "assistant" as const, content: "Try this approach..." },
      ];
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Follow-up question?",
        history,
      });
      expect(prompt).toContain("# CONVERSATION LOG");
      expect(prompt).toContain("Actor: What should I do?");
      expect(prompt).toContain("Coach: Try this approach...");
    });

    it("omits conversation history section when history is undefined", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        history: undefined,
      });
      expect(prompt).not.toContain("# CONVERSATION LOG");
    });

    it("omits conversation history section when history array is empty", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        history: [],
      });
      expect(prompt).not.toContain("# CONVERSATION LOG");
    });

    it("labels user messages as 'Actor'", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        history: [{ role: "user", content: "Actor's message" }],
      });
      expect(prompt).toContain("Actor: Actor's message");
    });

    it("labels assistant messages as 'Coach'", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        history: [{ role: "assistant", content: "Coach's response" }],
      });
      expect(prompt).toContain("Coach: Coach's response");
    });
  });

  describe("Audition Full Data Section", () => {
    it("includes ACTIVE AUDITION BREAKDOWN when auditionFullData is provided", () => {
      const auditionFullData = {
        project: "TestProject",
        role: "TestRole",
        performanceMap: {
          intro: "This is the introduction",
          sections: [
            { title: "Objectives", items: ["Find the goal", "Understand motivation"] },
          ],
          outro: "This is the outro",
        },
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).toContain("Project: TestProject");
      expect(prompt).toContain("Role: TestRole");
      expect(prompt).toContain("This is the introduction");
      expect(prompt).toContain("### Objectives");
      expect(prompt).toContain("Find the goal");
      expect(prompt).toContain("Understand motivation");
      expect(prompt).toContain("This is the outro");
    });

    it("omits ACTIVE AUDITION BREAKDOWN when auditionFullData is undefined", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: undefined,
      });
      expect(prompt).not.toContain("# ACTIVE AUDITION BREAKDOWN");
    });

    it("formats performance map items with bullet points", () => {
      const auditionFullData = {
        project: "TestProject",
        role: "TestRole",
        performanceMap: {
          sections: [
            { title: "Items", items: ["Item 1", "Item 2"] },
          ],
        },
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("• Item 1");
      expect(prompt).toContain("• Item 2");
    });

    it("renders both SIDES BREAKDOWN and BRIEF BREAKDOWN when both maps are present", () => {
      const auditionFullData = {
        project: "Hamlet",
        role: "Ophelia",
        hasSides: true,
        hasBrief: true,
        sidesPerformanceMap: {
          intro: "Sides intro text",
          sections: [
            { title: "Sides Scene", items: ["Sides line one", "Sides line two"] },
          ],
          outro: "Sides outro text",
        },
        briefPerformanceMap: {
          intro: "Brief intro text",
          sections: [
            { title: "Character Brief", items: ["Brief insight one", "Brief insight two"] },
          ],
          outro: "Brief outro text",
        },
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).toContain("# SIDES BREAKDOWN");
      expect(prompt).toContain("# BRIEF BREAKDOWN");
      expect(prompt).toContain("Sides intro text");
      expect(prompt).toContain("### Sides Scene");
      expect(prompt).toContain("Sides line one");
      expect(prompt).toContain("Sides outro text");
      expect(prompt).toContain("Brief intro text");
      expect(prompt).toContain("### Character Brief");
      expect(prompt).toContain("Brief insight one");
      expect(prompt).toContain("Brief outro text");
      expect(prompt).toContain("Project: Hamlet");
      expect(prompt).toContain("Role: Ophelia");
    });

    it("renders only SIDES BREAKDOWN when only sidesPerformanceMap is present", () => {
      const auditionFullData = {
        project: "Hamlet",
        role: "Ophelia",
        hasSides: true,
        hasBrief: false,
        sidesPerformanceMap: {
          intro: "Sides only intro",
          sections: [{ title: "Sides Section", items: ["Sides item"] }],
        },
        briefPerformanceMap: null,
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).toContain("# SIDES BREAKDOWN");
      expect(prompt).not.toContain("# BRIEF BREAKDOWN");
      expect(prompt).toContain("Sides only intro");
      expect(prompt).toContain("Sides item");
    });

    it("renders only BRIEF BREAKDOWN when only briefPerformanceMap is present", () => {
      const auditionFullData = {
        project: "Hamlet",
        role: "Ophelia",
        hasSides: false,
        hasBrief: true,
        sidesPerformanceMap: null,
        briefPerformanceMap: {
          intro: "Brief only intro",
          sections: [{ title: "Brief Section", items: ["Brief item"] }],
        },
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).toContain("# BRIEF BREAKDOWN");
      expect(prompt).not.toContain("# SIDES BREAKDOWN");
      expect(prompt).toContain("Brief only intro");
      expect(prompt).toContain("Brief item");
    });

    it("falls back to legacy performanceMap when new dual-map fields are absent (backward compat)", () => {
      const auditionFullData = {
        project: "LegacyProject",
        role: "LegacyRole",
        performanceMap: {
          intro: "Legacy intro",
          sections: [{ title: "Legacy Section", items: ["Legacy item"] }],
          outro: "Legacy outro",
        },
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).not.toContain("# SIDES BREAKDOWN");
      expect(prompt).not.toContain("# BRIEF BREAKDOWN");
      expect(prompt).toContain("Legacy intro");
      expect(prompt).toContain("Legacy item");
      expect(prompt).toContain("Legacy outro");
    });

    it("omits audition enrichment section entirely when auditionFullData has no maps", () => {
      const auditionFullData = {
        project: "EmptyProject",
        role: "EmptyRole",
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).not.toContain("# ACTIVE AUDITION BREAKDOWN");
      expect(prompt).not.toContain("# SIDES BREAKDOWN");
      expect(prompt).not.toContain("# BRIEF BREAKDOWN");
    });
  });

  describe("Section Ordering", () => {
    it("orders sections: System Prompt → Actor Identity → Actor DNA → Session Focus → Audition Data → Auditions → References → History → Question", () => {
      const fullInput: CoachPromptInput = {
        actorName: "TestActor",
        actorBaseline: "Test baseline",
        excerpts: [
          {
            citationNumber: 1,
            sourceBook: "TestBook",
            excerptText: "Test excerpt",
            score: 0.9,
          },
        ],
        question: "Test question?",
        currentFocus: {
          sessionFocus: "Test focus",
          stepIndex: 0,
          mode: "guided",
          phase: null,
        },
        history: [{ role: "user", content: "Previous message" }],
        auditions: [
          { id: "aud-1", project: "TestProj", role: "TestRole", createdAt: "2024-01-01" },
        ],
      };

      const prompt = buildCoachPrompt(fullInput);

      const actorDnaIdx = prompt.indexOf("# ACTOR DNA & PSYCHOLOGY");
      const focusIdx = prompt.indexOf("Session focus:");
      const auditionsIdx = prompt.indexOf("# ACTOR'S AUDITIONS");
      const refIdx = prompt.indexOf("# METHODOLOGY REFERENCE MATERIAL");
      const historyIdx = prompt.indexOf("# CONVERSATION LOG");
      const questionIdx = prompt.indexOf("# ACTOR'S CURRENT REQUEST");

      expect(actorDnaIdx).toBeGreaterThan(0);
      expect(focusIdx).toBeGreaterThan(actorDnaIdx);
      expect(auditionsIdx).toBeGreaterThan(0);
      expect(refIdx).toBeGreaterThan(auditionsIdx);
      expect(historyIdx).toBeGreaterThan(refIdx);
      expect(questionIdx).toBeGreaterThan(historyIdx);
    });
  });

  describe("CriticalBriefFacts Type Plumbing", () => {
    it("accepts criticalBriefFacts in auditionFullData without type casts", () => {
      const criticalBriefFacts: CriticalBriefFact[] = [
        { label: "Character Age", value: "Late 30s", importance: "important" },
        { label: "Director Style", value: "Method-oriented", importance: "critical" },
      ];
      const auditionFullData = {
        project: "TestProject",
        role: "TestRole",
        hasSides: true,
        hasBrief: true,
        sidesPerformanceMap: {
          intro: "Sides intro",
          sections: [{ title: "Sides Section", items: ["Sides item"] }],
        },
        briefPerformanceMap: {
          intro: "Brief intro",
          sections: [{ title: "Brief Section", items: ["Brief item"] }],
        },
        criticalBriefFacts,
      };
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData,
      });
      expect(prompt).toContain("TestProject");
    });
  });

  describe("Critical Brief Facts Section", () => {
    const criticalBriefFacts: CriticalBriefFact[] = [
      { label: "Character Age", value: "Late 30s", importance: "critical" },
      { label: "Director Style", value: "Method-oriented", importance: "important" },
    ];

    it("includes # CRITICAL BRIEF FACTS section when criticalBriefFacts is present", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: {
          project: "Hamlet",
          role: "Ophelia",
          criticalBriefFacts,
        },
      });
      expect(prompt).toContain("# CRITICAL BRIEF FACTS");
      expect(prompt).toContain("Character Age: Late 30s (critical)");
      expect(prompt).toContain("Director Style: Method-oriented (important)");
    });

    it("omits # CRITICAL BRIEF FACTS section when criticalBriefFacts is undefined", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: { project: "Hamlet", role: "Ophelia" },
      });
      expect(prompt).not.toContain("# CRITICAL BRIEF FACTS");
    });

    it("omits # CRITICAL BRIEF FACTS section when criticalBriefFacts is null", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: { project: "Hamlet", role: "Ophelia", criticalBriefFacts: null },
      });
      expect(prompt).not.toContain("# CRITICAL BRIEF FACTS");
    });

    it("omits # CRITICAL BRIEF FACTS section when criticalBriefFacts is empty", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: { project: "Hamlet", role: "Ophelia", criticalBriefFacts: [] },
      });
      expect(prompt).not.toContain("# CRITICAL BRIEF FACTS");
    });

    it("skips malformed facts with empty label or value rather than rendering placeholders", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: {
          project: "Hamlet",
          role: "Ophelia",
          criticalBriefFacts: [
            { label: "", value: "orphaned value", importance: "critical" },
            { label: "Valid Fact", value: "kept", importance: "important" },
            { label: "Missing Value", value: "", importance: "critical" },
          ],
        },
      });
      expect(prompt).toContain("# CRITICAL BRIEF FACTS");
      expect(prompt).toContain("Valid Fact: kept (important)");
      expect(prompt).not.toContain("orphaned value");
      expect(prompt).not.toContain("Missing Value: ");
    });

    it("renders critical brief facts alongside both performance maps, not in place of them", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: {
          project: "Hamlet",
          role: "Ophelia",
          hasSides: true,
          hasBrief: true,
          sidesPerformanceMap: {
            intro: "Sides intro",
            sections: [{ title: "Sides Section", items: ["sides item"] }],
          },
          briefPerformanceMap: {
            intro: "Brief intro",
            sections: [{ title: "Brief Section", items: ["brief item"] }],
          },
          criticalBriefFacts,
        },
      });
      expect(prompt).toContain("# CRITICAL BRIEF FACTS");
      expect(prompt).toContain("# SIDES BREAKDOWN");
      expect(prompt).toContain("# BRIEF BREAKDOWN");
    });

    it("places # CRITICAL BRIEF FACTS before # ACTIVE AUDITION BREAKDOWN", () => {
      const prompt = buildCoachPrompt({
        excerpts: [],
        question: "Test question?",
        auditionFullData: {
          project: "Hamlet",
          role: "Ophelia",
          hasSides: true,
          sidesPerformanceMap: {
            intro: "Sides intro",
            sections: [{ title: "Sides Section", items: ["sides item"] }],
          },
          criticalBriefFacts,
        },
      });
      const factsIdx = prompt.indexOf("# CRITICAL BRIEF FACTS");
      const mapIdx = prompt.indexOf("# ACTIVE AUDITION BREAKDOWN");
      expect(factsIdx).toBeGreaterThan(0);
      expect(mapIdx).toBeGreaterThan(factsIdx);
    });
  });
});
