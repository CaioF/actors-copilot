import { ARENA_THEMES, THEME_DISPLAY_NAMES, DNA_SECTIONS, SectionProgress, CoachSession, CoachMessage } from "./chat-types";

describe("ARENA_THEMES", () => {
  it("should have themes defined for all DNA sections", () => {
    DNA_SECTIONS.forEach((section) => {
      expect(ARENA_THEMES[section.id]).toBeDefined();
      expect(Array.isArray(ARENA_THEMES[section.id])).toBe(true);
    });
  });

  it("should have at least 4 themes per arena (required for completion)", () => {
    DNA_SECTIONS.forEach((section) => {
      const themes = ARENA_THEMES[section.id];
      expect(themes.length).toBeGreaterThanOrEqual(4);
    });
  });

  it("should have unique theme IDs within each arena", () => {
    DNA_SECTIONS.forEach((section) => {
      const themes = ARENA_THEMES[section.id];
      const uniqueThemes = new Set(themes);
      expect(uniqueThemes.size).toBe(themes.length);
    });
  });

  it("should have no empty theme strings", () => {
    DNA_SECTIONS.forEach((section) => {
      const themes = ARENA_THEMES[section.id];
      themes.forEach((theme) => {
        expect(theme.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it("should have theme IDs in snake_case format", () => {
    DNA_SECTIONS.forEach((section) => {
      const themes = ARENA_THEMES[section.id];
      themes.forEach((theme) => {
        expect(theme).toMatch(/^[a-z_]+$/);
      });
    });
  });

  it("should have shame arena with expected themes", () => {
    const shameThemes = ARENA_THEMES.shame;
    expect(shameThemes).toContain("shame_origin");
    expect(shameThemes).toContain("shame_trigger");
    expect(shameThemes).toContain("shame_coping");
    expect(shameThemes).toContain("shame_relationships");
    expect(shameThemes).toContain("shame_body");
    expect(shameThemes).toContain("shame_identity");
  });

  it("should have identity arena with expected themes", () => {
    const identityThemes = ARENA_THEMES.identity;
    expect(identityThemes).toContain("self_narrative");
    expect(identityThemes).toContain("core_traits");
    expect(identityThemes).toContain("values_anchor");
    expect(identityThemes).toContain("public_vs_private");
    expect(identityThemes).toContain("growth_narrative");
  });
});

describe("THEME_DISPLAY_NAMES", () => {
  it("should have display names for all themes in ARENA_THEMES", () => {
    DNA_SECTIONS.forEach((section) => {
      const themes = ARENA_THEMES[section.id];
      themes.forEach((theme) => {
        expect(THEME_DISPLAY_NAMES[theme]).toBeDefined();
        expect(typeof THEME_DISPLAY_NAMES[theme]).toBe("string");
      });
    });
  });

  it("should have non-empty display names", () => {
    Object.entries(THEME_DISPLAY_NAMES).forEach(([theme, displayName]) => {
      expect(displayName.trim().length).toBeGreaterThan(0);
    });
  });

  it("should have display names different from theme IDs", () => {
    Object.entries(THEME_DISPLAY_NAMES).forEach(([theme, displayName]) => {
      if (theme !== "novel_theme") {
        expect(displayName).not.toBe(theme);
      }
    });
  });

  it("should have display name for novel_theme", () => {
    expect(THEME_DISPLAY_NAMES["novel_theme"]).toBe("Novel Theme");
  });

  it("should have user-friendly display names (proper capitalization)", () => {
    Object.entries(THEME_DISPLAY_NAMES).forEach(([theme, displayName]) => {
      expect(displayName[0]).toBe(displayName[0].toUpperCase());
    });
  });
});

describe("SectionProgress interface", () => {
  it("should be able to create a valid SectionProgress object", () => {
    const progress: SectionProgress = {
      hqCount: 5,
      themesCovered: ["shame_origin", "shame_trigger", "shame_coping", "shame_identity"],
      themeCounts: {
        shame_origin: 2,
        shame_trigger: 1,
        shame_coping: 1,
        shame_identity: 1,
      },
      isComplete: true,
    };

    expect(progress.hqCount).toBe(5);
    expect(progress.themesCovered.length).toBe(4);
    expect(progress.isComplete).toBe(true);
  });

  it("should allow partial progress (not complete)", () => {
    const progress: SectionProgress = {
      hqCount: 3,
      themesCovered: ["shame_origin", "shame_trigger"],
      themeCounts: {
        shame_origin: 2,
        shame_trigger: 1,
      },
      isComplete: false,
    };

    expect(progress.hqCount).toBe(3);
    expect(progress.themesCovered.length).toBe(2);
    expect(progress.isComplete).toBe(false);
  });
});

describe("Theme deduplication logic", () => {
  it("should deduplicate themes within a single extraction", () => {
    const themesFromAI = ["shame_origin", "shame_origin", "shame_trigger"];

    // First deduplicate within the extraction itself
    const uniqueThemesFromAI = themesFromAI.filter(
      (t, index) => themesFromAI.indexOf(t) === index
    );

    expect(uniqueThemesFromAI).toEqual(["shame_origin", "shame_trigger"]);
  });

  it("should merge new themes with existing themes", () => {
    const existingThemes = ["shame_origin", "shame_trigger"];
    const newThemesFromAI = ["shame_coping", "shame_identity"];

    const uniqueNewThemes = newThemesFromAI.filter(
      (t) => !existingThemes.includes(t)
    );
    const mergedThemes = [...existingThemes, ...uniqueNewThemes];

    expect(mergedThemes).toEqual([
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
    ]);
  });

  it("should not add duplicate themes from multiple extractions", () => {
    const existingThemes = ["shame_origin", "shame_trigger"];

    const newThemesFromAI = ["shame_origin", "shame_coping"];

    const uniqueNewThemes = newThemesFromAI.filter(
      (t) => !existingThemes.includes(t)
    );
    const mergedThemes = [...existingThemes, ...uniqueNewThemes];

    expect(mergedThemes).toEqual([
      "shame_origin",
      "shame_trigger",
      "shame_coping",
    ]);
    expect(mergedThemes).toHaveLength(3);
  });

  it("should count unique themes correctly", () => {
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_origin",
      "shame_coping",
    ];
    const uniqueThemes = new Set(themesCovered);

    expect(uniqueThemes.size).toBe(3);
  });
});

describe("Theme requirement validation", () => {
  const REQUIRED_THEMES = 4;
  const HQ_FOR_COMPLETION = 5;

  it("should not complete section with only count but insufficient themes", () => {
    const hqCount = 5;
    const themesCovered = ["shame_origin"]; // Only 1 unique theme
    const uniqueThemes = new Set(themesCovered);

    const meetsThemeRequirement = uniqueThemes.size >= REQUIRED_THEMES;
    const meetsCountRequirement = hqCount >= HQ_FOR_COMPLETION;
    const isComplete = meetsCountRequirement && meetsThemeRequirement;

    expect(isComplete).toBe(false);
  });

  it("should not complete section with only themes but insufficient count", () => {
    const hqCount = 3; // Insufficient
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
    ];
    const uniqueThemes = new Set(themesCovered);

    const meetsThemeRequirement = uniqueThemes.size >= REQUIRED_THEMES;
    const meetsCountRequirement = hqCount >= HQ_FOR_COMPLETION;
    const isComplete = meetsCountRequirement && meetsThemeRequirement;

    expect(isComplete).toBe(false);
  });

  it("should complete section with sufficient count and themes", () => {
    const hqCount = 5;
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
    ];
    const uniqueThemes = new Set(themesCovered);

    const meetsThemeRequirement = uniqueThemes.size >= REQUIRED_THEMES;
    const meetsCountRequirement = hqCount >= HQ_FOR_COMPLETION;
    const isComplete = meetsCountRequirement && meetsThemeRequirement;

    expect(isComplete).toBe(true);
  });

  it("should allow more than required themes", () => {
    const hqCount = 7;
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
      "shame_body",
      "shame_relationships",
    ];
    const uniqueThemes = new Set(themesCovered);

    const meetsThemeRequirement = uniqueThemes.size >= REQUIRED_THEMES;
    const meetsCountRequirement = hqCount >= HQ_FOR_COMPLETION;
    const isComplete = meetsCountRequirement && meetsThemeRequirement;

    expect(isComplete).toBe(true);
    expect(uniqueThemes.size).toBe(6);
  });
});

describe("Progress calculation with diversity weighting", () => {
  const TOTAL_SECTIONS = 12;
  const REQUIRED_THEMES = 4;
  const HQ_FOR_COMPLETION = 5;
  const DIVERSITY_WEIGHT = 0.6;
  const COUNT_WEIGHT = 0.4;

  function calculateSectionProgress(
    hqCount: number,
    themesCovered: string[],
    isComplete: boolean
  ): number {
    if (isComplete) {
      return 100 / TOTAL_SECTIONS;
    }

    const uniqueThemes = new Set(themesCovered);
    const diversityScore = Math.min(uniqueThemes.size / REQUIRED_THEMES, 1);
    const countScore = Math.min(hqCount / HQ_FOR_COMPLETION, 1);
    const sectionScore =
      diversityScore * DIVERSITY_WEIGHT + countScore * COUNT_WEIGHT;
    return sectionScore * (100 / TOTAL_SECTIONS);
  }

  it("should give full credit to completed sections", () => {
    const progress = calculateSectionProgress(10, ["shame_origin"], true);
    expect(progress).toBeCloseTo(100 / TOTAL_SECTIONS, 5);
  });

  it("should give zero progress for untouched section", () => {
    const progress = calculateSectionProgress(0, [], false);
    expect(progress).toBeCloseTo(0, 5);
  });

  it("should give partial progress based on count only", () => {
    const hqCount = 3;
    const themesCovered: string[] = [];
    const progress = calculateSectionProgress(hqCount, themesCovered, false);

    const countScore = hqCount / HQ_FOR_COMPLETION;
    const expectedProgress =
      countScore * COUNT_WEIGHT * (100 / TOTAL_SECTIONS);

    expect(progress).toBeCloseTo(expectedProgress, 5);
  });

it("should give partial progress based on themes only", () => {
    const hqCount = 1;
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
    ];
    const progress = calculateSectionProgress(hqCount, themesCovered, false);

    // diversityScore = min(4/4, 1) = 1.0
    // countScore = min(1/5, 1) = 0.2
    // sectionScore = 1.0 * 0.6 + 0.2 * 0.4 = 0.6 + 0.08 = 0.68
    // progress = 0.68 * (100/12) = 5.67
    expect(progress).toBeCloseTo(5.67, 1);
  });

  it("should cap diversity score at 1.0", () => {
    const hqCount = 1;
    const themesCovered = [
      "shame_origin",
      "shame_trigger",
      "shame_coping",
      "shame_identity",
      "shame_body",
      "shame_relationships",
    ];
    const progress = calculateSectionProgress(hqCount, themesCovered, false);

    // With 6 themes, diversityScore = min(6/4, 1) = 1.0 (capped)
    // countScore = min(1/5, 1) = 0.2
    // sectionScore = 1.0 * 0.6 + 0.2 * 0.4 = 0.68
    // progress = 0.68 * (100/12) = 5.67
    expect(progress).toBeCloseTo(5.67, 1);
  });

  it("should combine diversity and count for mid-progress section", () => {
    const hqCount = 3;
    const themesCovered = ["shame_origin", "shame_trigger"];
    const progress = calculateSectionProgress(hqCount, themesCovered, false);

    const diversityScore = 2 / REQUIRED_THEMES; // 0.5
    const countScore = hqCount / HQ_FOR_COMPLETION; // 0.6
    const expectedScore =
      diversityScore * DIVERSITY_WEIGHT + countScore * COUNT_WEIGHT; // 0.54
    const expectedProgress = expectedScore * (100 / TOTAL_SECTIONS);

    expect(progress).toBeCloseTo(expectedProgress, 5);
  });

  it("should sum progress across multiple sections correctly", () => {
    const sections = [
      { hqCount: 5, themes: ["shame_origin"], isComplete: true },
      { hqCount: 3, themes: ["self_narrative", "core_traits"], isComplete: false },
      { hqCount: 0, themes: [], isComplete: false },
    ];

    const totalProgress = sections.reduce((sum, section) => {
      return sum + calculateSectionProgress(section.hqCount, section.themes, section.isComplete);
    }, 0);

    expect(totalProgress).toBeLessThan(100);
    expect(totalProgress).toBeGreaterThan(0);
  });
});

describe("CoachSession interface", () => {
  it("should have exactly 11 fields: id, createdAt, lastActiveAt, status, title, linkedAuditionId, messageCount, sessionFocus, stepIndex, mode, phase", () => {
    const session: CoachSession = {
      id: "test-session-id",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: null,
      phase: null,
    };

    expect(Object.keys(session)).toHaveLength(11);
    expect(Object.keys(session)).toEqual([
      "id",
      "createdAt",
      "lastActiveAt",
      "status",
      "title",
      "linkedAuditionId",
      "messageCount",
      "sessionFocus",
      "stepIndex",
      "mode",
      "phase",
    ]);
  });

  it("should not have any DNA-specific fields", () => {
    const session: CoachSession = {
      id: "test-session-id",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: null,
      phase: null,
    };

    expect(session).not.toHaveProperty("section");
    expect(session).not.toHaveProperty("sessionNumber");
    expect(session).not.toHaveProperty("currentSection");
    expect(session).not.toHaveProperty("sectionHqCounts");
    expect(session).not.toHaveProperty("askedQuestions");
    expect(session).not.toHaveProperty("totalSessions");
    expect(session).not.toHaveProperty("progress");
    expect(session).not.toHaveProperty("durationMinutes");
  });

  it("should allow status to be active or completed", () => {
    const activeSession: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: null,
      phase: null,
    };

    const completedSession: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "completed",
      title: null,
      linkedAuditionId: null,
      messageCount: 5,
      sessionFocus: null,
      stepIndex: 0,
      mode: null,
      phase: null,
    };

    expect(activeSession.status).toBe("active");
    expect(completedSession.status).toBe("completed");
  });

  it("should allow title and linkedAuditionId to be nullable", () => {
    const session: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: "Scene work prep",
      linkedAuditionId: "audition-123",
      messageCount: 3,
      sessionFocus: null,
      stepIndex: 0,
      mode: null,
      phase: null,
    };

    expect(session.title).toBe("Scene work prep");
    expect(session.linkedAuditionId).toBe("audition-123");
  });

  it("should allow sessionFocus, stepIndex, mode, and phase to be set", () => {
    const session: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 3,
      sessionFocus: "Find Jane's objective in scene 2",
      stepIndex: 2,
      mode: "guided",
      phase: "objective",
    };

    expect(session.sessionFocus).toBe("Find Jane's objective in scene 2");
    expect(session.stepIndex).toBe(2);
    expect(session.mode).toBe("guided");
    expect(session.phase).toBe("objective");
  });

  it("should allow mode to be guided, informational, or transition", () => {
    const guidedSession: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: "guided",
      phase: null,
    };

    const informationalSession: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: "informational",
      phase: null,
    };

    const transitionSession: CoachSession = {
      id: "test",
      createdAt: null,
      lastActiveAt: null,
      status: "active",
      title: null,
      linkedAuditionId: null,
      messageCount: 0,
      sessionFocus: null,
      stepIndex: 0,
      mode: "transition",
      phase: null,
    };

    expect(guidedSession.mode).toBe("guided");
    expect(informationalSession.mode).toBe("informational");
    expect(transitionSession.mode).toBe("transition");
  });
});

describe("CoachMessage interface", () => {
  it("should have exactly 4 fields: id, role, content, timestamp", () => {
    const message: CoachMessage = {
      id: "msg-1",
      role: "user",
      content: "Hello coach",
      timestamp: null,
    };

    expect(Object.keys(message)).toHaveLength(4);
    expect(Object.keys(message)).toEqual(["id", "role", "content", "timestamp"]);
  });

  it("should not have a section field", () => {
    const message: CoachMessage = {
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: null,
    };

    expect(message).not.toHaveProperty("section");
  });

  it("should allow role to be user or assistant", () => {
    const userMsg: CoachMessage = {
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: null,
    };

    const assistantMsg: CoachMessage = {
      id: "msg-2",
      role: "assistant",
      content: "Hello! How can I help?",
      timestamp: null,
    };

    expect(userMsg.role).toBe("user");
    expect(assistantMsg.role).toBe("assistant");
  });
});

describe("Backward compatibility for sessions without theme data", () => {
  const HQ_FOR_COMPLETION = 5;

  function calculateProgressFallback(
    hqCount: number,
    themesCovered: string[] | undefined,
    isComplete: boolean
  ): number {
    const TOTAL_SECTIONS = 12;

    if (isComplete) {
      return 100 / TOTAL_SECTIONS;
    }

    // Per-section fallback: if no theme data, use count only
    if (!themesCovered || themesCovered.length === 0) {
      return (hqCount / HQ_FOR_COMPLETION) * (100 / TOTAL_SECTIONS);
    }

    // New behavior with themes
    const uniqueThemes = new Set(themesCovered);
    const diversityScore = Math.min(uniqueThemes.size / 4, 1);
    const countScore = Math.min(hqCount / HQ_FOR_COMPLETION, 1);
    const sectionScore = diversityScore * 0.6 + countScore * 0.4;
    return sectionScore * (100 / TOTAL_SECTIONS);
  }

  it("should fall back to count-based progress when no theme data", () => {
    const progress = calculateProgressFallback(3, undefined, false);
    const expectedProgress = (3 / HQ_FOR_COMPLETION) * (100 / 12);
    expect(progress).toBeCloseTo(expectedProgress, 5);
  });

  it("should fall back to count-based progress when themes array is empty", () => {
    const progress = calculateProgressFallback(3, [], false);
    const expectedProgress = (3 / HQ_FOR_COMPLETION) * (100 / 12);
    expect(progress).toBeCloseTo(expectedProgress, 5);
  });

  it("should use diversity-weighted progress when themes exist", () => {
    const progress = calculateProgressFallback(3, ["shame_origin", "shame_trigger"], false);
    expect(progress).toBeLessThan((3 / HQ_FOR_COMPLETION) * (100 / 12));
  });
});
