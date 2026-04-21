import { profileToMarkdown } from "./profile-to-markdown";
import { ActorProfile } from "@/lib/profile-types";

/**
 * Factory utility to generate a baseline ActorProfile for testing.
 * Uses type assertion (as ActorProfile) so we only need to provide the fields 
 * relevant to the tests, without triggering TypeScript excess property errors.
 */
const createMockProfile = (overrides?: Partial<ActorProfile>): ActorProfile & { lastUpdated?: string } => {
  const baseDefaults: Partial<ActorProfile> = {
    slug: "jane-doe",
    status: "published",
    fullName: "Jane Doe",
    bio: "",
    gender: "Female",
    playingAgeMin: 20,
    playingAgeMax: 30,
    height: "170cm",
    nationalities: ["American"],
    location: "Los Angeles, CA",
    skillsAndAccents: [],
    training: [],
    credits: [],
    showreels: [],
    additionalPhotos: [],
    showContactPublicly: false,
  };

  return {
    ...baseDefaults,
    ...overrides,
    lastUpdated: "2023-10-01T12:00:00.000Z",
  } as ActorProfile & { lastUpdated?: string };
};

describe("Markdown Generator: profileToMarkdown", () => {
  const BASE_URL = "https://actorscopilot.com";

  describe("Core Structure & Frontmatter Definition", () => {
    it("should generate a valid YAML frontmatter block with essential schema.org fields", () => {
      const profile = createMockProfile({
        bio: "An aspiring actor.",
        headshot: "https://example.com/headshot.jpg",
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      // Verify Frontmatter boundaries
      expect(markdown).toMatch(/^---\n/);
      
      // Verify schema.org context
      expect(markdown).toContain('@context: "https://schema.org"');
      expect(markdown).toContain('@type: "Person"');
      expect(markdown).toContain('name: "Jane Doe"');
      expect(markdown).toContain(`url: "${BASE_URL}/actors/jane-doe"`);
      expect(markdown).toContain('image: "https://example.com/headshot.jpg"');
    });

    it("should include the main H1 title and canonical URL footer", () => {
      const profile = createMockProfile();
      const markdown = profileToMarkdown(profile, BASE_URL);

      expect(markdown).toContain("# Jane Doe");
      expect(markdown).toContain(`canonical page](${BASE_URL}/actors/jane-doe)`);
    });

    it("should inject the invisible AI_AGENT_CONTEXT block securely", () => {
      const profile = createMockProfile();
      const markdown = profileToMarkdown(profile, BASE_URL);

      expect(markdown).toContain("<!-- AI_AGENT_CONTEXT");
    });
  });

  describe("Defensive Rendering & Conditional Sections", () => {
    it("should completely omit optional sections when underlying data is empty arrays or strings", () => {
      const emptyProfile = createMockProfile({
        bio: "",
        credits: [],
        showreels: [],
        training: [],
        skillsAndAccents: [],
        awardsCallout: "",
      });

      const markdown = profileToMarkdown(emptyProfile, BASE_URL);

      // These headers should NOT exist in the final output
      expect(markdown).not.toContain("## About");
      expect(markdown).not.toContain("## Credits");
      expect(markdown).not.toContain("## Showreels & Demo Reels");
      expect(markdown).not.toContain("## Training & Education");
      expect(markdown).not.toContain("## Skills & Accents");
      expect(markdown).not.toContain("## Awards & Recognition");
    });

    it("should conditionally obscure representation details based on privacy flags", () => {
      // Test case 1: Private
      const privateProfile = createMockProfile({
        showContactPublicly: false,
        agencyName: "CAA",
        agencyEmail: "agent@caa.com",
      });
      expect(profileToMarkdown(privateProfile, BASE_URL)).not.toContain("## Representation");

      // Test case 2: Public
      const publicProfile = createMockProfile({
        showContactPublicly: true,
        agencyName: "CAA",
        agencyEmail: "agent@caa.com",
      });
      const publicMarkdown = profileToMarkdown(publicProfile, BASE_URL);
      
      expect(publicMarkdown).toContain("## Representation");
      expect(publicMarkdown).toContain("**Agency:** CAA");
      expect(publicMarkdown).toContain("**Email:** agent@caa.com");
    });
  });

  describe("Complex Data Formatting (Tables & Grouping)", () => {
    it("should accurately construct the physical details Markdown table", () => {
      const profile = createMockProfile({
        height: "175cm",
        gender: "Non-Binary",
        eyeColour: "Hazel",
        hairColour: "Brown",
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      expect(markdown).toContain("## Details");
      expect(markdown).toContain("| Attribute | Value |");
      expect(markdown).toContain("|---|---|");
      expect(markdown).toContain("| Height | 175cm |");
      expect(markdown).toContain("| Gender | Non-Binary |");
      expect(markdown).toContain("| Eye Colour | Hazel |");
    });

    it("should aggregate credits by category and format them as distinct Markdown tables", () => {
      const profile = createMockProfile({
        credits: [
          // FIXED: Removed 'id', changed category to 'feature_film'
          { title: "Indie Film", role: "Lead", year: "2022", category: "feature_film", productionCompany: "A24", featured: true },
          { title: "Hamlet", role: "Ophelia", year: "2021", category: "stage", productionCompany: "Globe", featured: false },
        ],
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      // Verify table row injection
      expect(markdown).toContain("| Indie Film | Lead | 2022 | A24 |");
      expect(markdown).toContain("| Hamlet | Ophelia | 2021 | Globe |");

      // Verify the 'Notable / Featured Credits' extraction logic
      expect(markdown).toContain("### Notable / Featured Credits");
      expect(markdown).toContain("- **Indie Film** — Lead (2022), A24");
      // Hamlet was not featured, so it shouldn't be in the featured list
      expect(markdown).not.toContain("- **Hamlet** — Ophelia"); 
    });
  });

  describe("Data Escaping & Edge Cases", () => {
    it("should correctly escape Markdown table pipes (|) within credit titles to prevent table corruption", () => {
      const profile = createMockProfile({
        credits: [
          // FIXED: Removed 'id', changed category to 'television'
          { title: "Law | Order", role: "Cop", year: "2023", category: "television", productionCompany: "", featured: false },
        ],
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      // The pipe should be escaped as \| so the markdown parser doesn't create a new column
      expect(markdown).toContain("| Law \\| Order | Cop | 2023 |  |");
    });

    it("should correctly escape double quotes and newlines in YAML fields to prevent YAML parse errors", () => {
      const profile = createMockProfile({
        bio: 'An actor who says "Hello World".\nLoves theater.',
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      // Quotes should be escaped with backslashes, and newlines replaced with spaces
      expect(markdown).toContain('description: "An actor who says \\"Hello World\\". Loves theater."');
    });
  });

  describe("Structured Casting Data (JSON-LD)", () => {
    it("should embed a valid JSON-LD code block for automated systems", () => {
      const profile = createMockProfile({
        skillsAndAccents: ["Juggling", "British Accent"],
      });

      const markdown = profileToMarkdown(profile, BASE_URL);

      // Extract the JSON block using a regex
      const jsonMatch = markdown.match(/```json\n([\s\S]*?)\n```/);
      expect(jsonMatch).not.toBeNull();

      if (jsonMatch) {
        const jsonString = jsonMatch[1];
        // Ensure the string can be parsed back into a valid JS object without throwing
        const parsedJson = JSON.parse(jsonString);

        expect(parsedJson["@context"]).toBe("https://schema.org");
        expect(parsedJson["@type"]).toBe("Person");
        expect(parsedJson.name).toBe("Jane Doe");
        expect(parsedJson.knowsAbout).toEqual(["Juggling", "British Accent"]);
      }
    });
  });
});