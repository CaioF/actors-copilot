import { parseDnaProfileData, formatChatDuration } from "@/lib/dna/dna-parser";

describe("parseDnaProfileData", () => {
  it("parses empty profile data gracefully", () => {
    const result = parseDnaProfileData({});
    expect(result.attributes).toEqual([]);
    expect(result.completion).toBe(0.05);
    expect(result.aiSummary).toContain("No AI summary available yet");
    expect(result.analysisTimeline).toEqual([]);
    expect(result.leafSnippets).toEqual([]);
    expect(result.totalChatSeconds).toBe(0);
  });

  it("correctly parses totalChatSeconds and totalChatDurationSeconds fallback", () => {
    const res1 = parseDnaProfileData({ totalChatSeconds: 15300 });
    expect(res1.totalChatSeconds).toBe(15300);

    const res2 = parseDnaProfileData({ totalChatDurationSeconds: 2700 });
    expect(res2.totalChatSeconds).toBe(2700);
  });

  it("correctly parses nested psychology, acting_fuel, history, and physicality fields", () => {
    const mockData = {
      totalChatSeconds: 9000,
      psychology: {
        traits: ["Introspective", "Perfectionist"],
        defenseMechanisms: ["Intellectualization"],
        coreValues: ["Authenticity"],
        relationalDynamics: ["Guarded with authority figures"],
        analysisTimeline: [
          { inference: "Uses perfectionism to shield vulnerability", section: "identity", timestamp: "2026-08-20T10:00:00Z" }
        ],
        leafSnippets: [
          { quote: "I always feel I need to get it right the first time.", section: "identity", timestamp: "2026-08-20T10:00:00Z" }
        ]
      },
      acting_fuel: {
        coreWounds: ["Fear of failure"],
        unmetNeeds: ["Unconditional acceptance"],
        publicMasks: ["The confident overachiever"],
        archetypes: ["The Performer"]
      },
      physicality: {
        somaticTells: ["Micro-tension in jaw during conflict"]
      },
      history: {
        keyEntities: ["Strict early mentor"]
      },
      aiSummary: "Deep psychological profile extracted from 3 sessions."
    };

    const result = parseDnaProfileData(mockData);

    expect(result.attributes.length).toBe(11);
    expect(result.aiSummary).toBe("Deep psychological profile extracted from 3 sessions.");
    expect(result.analysisTimeline.length).toBe(1);
    expect(result.analysisTimeline[0].inference).toBe("Uses perfectionism to shield vulnerability");
    expect(result.leafSnippets.length).toBe(1);
    expect(result.leafSnippets[0].quote).toBe("I always feel I need to get it right the first time.");
    expect(result.totalChatSeconds).toBe(9000);

    // Check categories mapping
    const categories = result.attributes.map((a) => a.category);
    expect(categories).toContain("Core Traits & Persona");
    expect(categories).toContain("Values, Motivations & Emotional Reservoirs");
    expect(categories).toContain("Communication & Vocal Dynamics");
    expect(categories).toContain("Physicality & Instincts");
  });

  it("handles vaultDocs subcollection documents", () => {
    const mockDoc = {
      aiSummary: "Master summary"
    };

    const mockVaultDocs = [
      {
        section: "emotional_reservoirs",
        extractions: {
          core_values: ["Resilience"],
          new_traits: ["Adaptable"]
        }
      }
    ];

    const result = parseDnaProfileData(mockDoc, mockVaultDocs);
    expect(result.attributes.map(a => a.name)).toEqual(expect.arrayContaining(["Resilience"]));
  });

  it("correctly parses Firestore documents with literal dot-string field names (e.g. acting_fuel.archetypes)", () => {
    const firestoreDotDoc = {
      "acting_fuel.archetypes": ["The Caretaker", "The Loner"],
      "acting_fuel.coreWounds": ["Parental unreliability", "Childhood social rejection/bullying", "Fear of dependency"],
      "acting_fuel.unmetNeeds": ["Need for a stable and reliable caregiver", "Need for acceptance from peers"],
      "history.keyEntities": ["mother", "school"],
      "history.milestones": [
        {
          discoveredAt: "2026-08-20T17:26:43.802Z",
          emotional_cost: "Loss of childhood, immense pressure",
          event: "Forced to act as the 'adult' to their own mother during childhood.",
          section: "identity"
        }
      ],
      "psychology.analysisTimeline": [
        { inference: "The user's core trait of 'determination' is now clearly framed as a trauma response." }
      ]
    };

    const result = parseDnaProfileData(firestoreDotDoc);

    const traitNames = result.attributes.map(a => a.name);
    expect(traitNames).toEqual(expect.arrayContaining([
      "The Caretaker",
      "The Loner",
      "Parental unreliability",
      "Childhood social rejection/bullying",
      "Fear of dependency",
      "Need for a stable and reliable caregiver",
      "Need for acceptance from peers",
      "mother",
      "school",
      "Forced to act as the 'adult' to their own mother during childhood."
    ]));

    expect(result.analysisTimeline.length).toBe(1);
    expect(result.analysisTimeline[0].inference).toContain("determination");
  });
});

describe("formatChatDuration", () => {
  it("formats seconds into human readable strings", () => {
    expect(formatChatDuration(0)).toBe("0s");
    expect(formatChatDuration(12)).toBe("12s");
    expect(formatChatDuration(2700)).toBe("45m");
    expect(formatChatDuration(9000)).toBe("2h 30m");
    expect(formatChatDuration(15300)).toBe("4h 15m");
    expect(formatChatDuration(3600)).toBe("1h");
  });
});


