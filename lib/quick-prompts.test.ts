import { QUICK_PROMPTS, QUICK_PROMPT_CATEGORIES, QuickPrompt } from "./quick-prompts";

describe("lib/quick-prompts", () => {
  it("exports exactly 4 categories with id and label", () => {
    expect(QUICK_PROMPT_CATEGORIES).toHaveLength(4);
    const ids = QUICK_PROMPT_CATEGORIES.map((cat) => cat.id);
    expect(ids).toContain("actors_craft");
    expect(ids).toContain("actors_career");
    expect(ids).toContain("actors_mindset");
    expect(ids).toContain("profile_management");
  });

  it("exports exactly 67 prompts with correct schema", () => {
    expect(QUICK_PROMPTS).toHaveLength(67);
    
    QUICK_PROMPTS.forEach((prompt) => {
      expect(prompt).toHaveProperty("id");
      expect(typeof prompt.id).toBe("string");
      expect(prompt).toHaveProperty("text");
      expect(typeof prompt.text).toBe("string");
      expect(prompt.text.length).toBeGreaterThan(0);
      expect(prompt.text.length).toBeLessThanOrEqual(800);
      
      const validCategories = ["actors_craft", "actors_career", "actors_mindset", "profile_management"];
      expect(validCategories).toContain(prompt.category);
      expect(Array.isArray(prompt.placeholderKeys)).toBe(true);
    });
  });

  it("exports exact prompt counts per category per requirements", () => {
    const craft = QUICK_PROMPTS.filter((p) => p.category === "actors_craft");
    const career = QUICK_PROMPTS.filter((p) => p.category === "actors_career");
    const mindset = QUICK_PROMPTS.filter((p) => p.category === "actors_mindset");
    const profileManagement = QUICK_PROMPTS.filter((p) => p.category === "profile_management");

    expect(craft).toHaveLength(21);
    expect(career).toHaveLength(20);
    expect(mindset).toHaveLength(20);
    expect(profileManagement).toHaveLength(6);
  });

  it("ensures no duplicate prompt IDs", () => {
    const ids = QUICK_PROMPTS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("exports new profile_management prompts with correct IDs", () => {
    const profileBio = QUICK_PROMPTS.find((p) => p.id === "profile-bio");
    expect(profileBio).toBeDefined();
    expect(profileBio).toEqual(expect.objectContaining({ category: "profile_management" }));

    const profileBioUpdate = QUICK_PROMPTS.find((p) => p.id === "profile-bio-update");
    expect(profileBioUpdate).toBeDefined();
    expect(profileBioUpdate).toEqual(expect.objectContaining({ category: "profile_management" }));

    const profileHeadshot = QUICK_PROMPTS.find((p) => p.id === "profile-headshot");
    expect(profileHeadshot).toBeDefined();
    expect(profileHeadshot).toEqual(expect.objectContaining({ category: "profile_management" }));

    const profileCredits = QUICK_PROMPTS.find((p) => p.id === "profile-credits");
    expect(profileCredits).toBeDefined();
    expect(profileCredits).toEqual(expect.objectContaining({ category: "profile_management" }));

    const profileSkills = QUICK_PROMPTS.find((p) => p.id === "profile-skills");
    expect(profileSkills).toBeDefined();
    expect(profileSkills).toEqual(expect.objectContaining({ category: "profile_management" }));

    const profileTraining = QUICK_PROMPTS.find((p) => p.id === "profile-training");
    expect(profileTraining).toBeDefined();
    expect(profileTraining).toEqual(expect.objectContaining({ category: "profile_management" }));
  });

  it("placeholderKeys matches bracket occurrences in text exactly", () => {
    // Regex matches [content] extracting 'content' without the brackets
    const bracketRegex = /\[(.*?)\]/g;

    QUICK_PROMPTS.forEach((prompt) => {
      const matches = Array.from(prompt.text.matchAll(bracketRegex)).map((m) => m[1]);
      
      // The extracted keys must exactly match the length and values specified
      expect(prompt.placeholderKeys).toHaveLength(matches.length);
      expect(prompt.placeholderKeys).toEqual(expect.arrayContaining(matches));
    });
  });
});