import { extractPlaceholders, fillTemplate } from "./template-filler";

describe("lib/template-filler", () => {
  describe("extractPlaceholders", () => {
    it("returns correct array for text with multiple placeholders", () => {
      expect(extractPlaceholders("I am [role] and I need help with [scene]")).toEqual(["role", "scene"]);
    });

    it("returns array for realistic prompt syntax with spaces", () => {
      expect(extractPlaceholders("Help me draft an email to [Agents Website]")).toEqual(["Agents Website"]);
    });

    it("returns empty array for text with no brackets", () => {
      expect(extractPlaceholders("Just a normal sentence with no brackets.")).toEqual([]);
    });

    it("deduplicates identical placeholders", () => {
      expect(extractPlaceholders("Hello [role], you are a great [role]")).toEqual(["role"]);
    });

    it("handles [variable:default] syntax, extracting only the variable", () => {
      expect(extractPlaceholders("Send to [name:John Doe]")).toEqual(["name"]);
    });

    it("handles colon-delimited default with spaces", () => {
      expect(extractPlaceholders("My vibe is [vibe:some long default text with spaces]")).toEqual(["vibe"]);
    });
  });

  describe("fillTemplate", () => {
    it("replaces single occurrences with provided value in vars", () => {
      expect(
        fillTemplate("I am [role] and I need help with [scene]", { role: "lead", scene: "Act III" })
      ).toBe("I am lead and I need help with Act III");
    });

    it("replaces ALL occurrences of the same placeholder globally", () => {
      expect(
        fillTemplate("[role] is good, [role] is great", { role: "lead" })
      ).toBe("lead is good, lead is great");
    });

    it("leaves unreplaced placeholders intact if missing from vars", () => {
      expect(
        fillTemplate("Hello [name], see you in [missing]", { name: "Alice" })
      ).toBe("Hello Alice, see you in [missing]");
    });

    it("returns input unchanged if vars is empty", () => {
      expect(fillTemplate("Hello [name]", {})).toBe("Hello [name]");
    });

    it("handles [variable:default] syntax using the default if vars is missing the key", () => {
      expect(fillTemplate("I am [role:Hero]", {})).toBe("I am Hero");
    });

    it("handles [variable:default] syntax using vars if provided over default", () => {
      expect(fillTemplate("I am [role:Hero]", { role: "Villain" })).toBe("I am Villain");
    });

    it("handles empty string input gracefully", () => {
      expect(fillTemplate("", { role: "lead" })).toBe("");
    });

    it("handles null or undefined values in vars without throwing", () => {
      expect(
        fillTemplate("Hello [name]", { name: undefined })
      ).toBe("Hello [name]");
    });
  });
});