import { auditionFormDataSchema } from "./audition";

/**
 * Creates a real File instance with an optionally overridden size.
 * This avoids allocating large buffers in tests while still exercising
 * the instanceof File check in auditionFileSchema.
 */
function makeFile(name: string, type: string, size?: number): File {
  const file = new File(["x"], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size, configurable: true });
  }
  return file;
}

describe("auditionFormDataSchema", () => {
  describe("valid inputs", () => {
    it("should pass with valid minimal FormData object (text only)", () => {
      const validInput = {
        projectType: "cinematic",
        project: "Hamlet",
        role: "Hamlet",
        actorName: "John Smith",
        userPath: "user123_path",
        sidesText: "To be or not to be",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should pass with all fields populated", () => {
      const validInput = {
        projectType: "theater",
        project: "Romeo and Juliet",
        role: "Juliet",
        actorName: "Jane Doe",
        userPath: "user456_path",
        sidesText: "What's in a name?",
        briefText: "Young maiden from Verona",
        sidesFile: makeFile("script.pdf", "application/pdf", 1024),
        briefFile: makeFile("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 512),
        deadline: "2026-06-15T14:00",
        auditionTimezone: "America/Los_Angeles",
        priorSidesSummary: "Prior sides summary text",
        priorBriefSummary: "Prior brief summary text",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should pass with commercial projectType", () => {
      const validInput = {
        projectType: "commercial",
        project: "Nike Ad",
        role: "Active Person",
        actorName: "Athlete",
        userPath: "user789_path",
        sidesText: "Just do it",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should pass with valid docx file", () => {
      const validInput = {
        projectType: "cinematic",
        project: "Feature Film",
        role: "Lead",
        actorName: "Actor Name",
        userPath: "user111_path",
        sidesText: "",
        briefText: "",
        sidesFile: makeFile("sides.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 2048),
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("actorName default", () => {
    it("should default actorName to 'Actor' when absent", () => {
      const inputWithoutActorName = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(inputWithoutActorName);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actorName).toBe("Actor");
      }
    });

    it("should coerce empty-string actorName to 'Actor' via route-level || guard (schema accepts empty)", () => {
      const inputWithEmptyActorName = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(inputWithEmptyActorName);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actorName).toBe("");
      }
    });
  });

  describe("projectType validation", () => {
    it("should fail with invalid projectType", () => {
      const invalidInput = {
        projectType: "musical",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("projectType");
      }
    });

    it("should fail with empty projectType", () => {
      const invalidInput = {
        projectType: "",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("project validation", () => {
    it("should fail when project exceeds 150 characters", () => {
      const longProject = "A".repeat(151);
      const invalidInput = {
        projectType: "cinematic",
        project: longProject,
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("project");
      }
    });

    it("should pass with project at exactly 150 characters", () => {
      const exactProject = "A".repeat(150);
      const validInput = {
        projectType: "cinematic",
        project: exactProject,
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("role validation", () => {
    it("should fail when role exceeds 100 characters", () => {
      const longRole = "B".repeat(101);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: longRole,
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("role");
      }
    });

    it("should pass with role at exactly 100 characters", () => {
      const exactRole = "B".repeat(100);
      const validInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: exactRole,
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("file validation", () => {
    it("should fail when sidesFile exceeds 20MB", () => {
      const oversizedFile = makeFile("script.pdf", "application/pdf", 21 * 1024 * 1024);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: oversizedFile,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("20MB");
      }
    });

    it("should fail when briefFile exceeds 20MB", () => {
      const oversizedFile = makeFile("brief.pdf", "application/pdf", 25 * 1024 * 1024);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: oversizedFile,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("20MB");
      }
    });

    it("should fail when file has unsupported MIME type", () => {
      const invalidFile = makeFile("image.jpg", "image/jpeg", 1024);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: invalidFile,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("PDFs and Word documents");
      }
    });

    it("should pass with file at exactly 20MB", () => {
      const exactFile = makeFile("script.pdf", "application/pdf", 20 * 1024 * 1024);
      const validInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: exactFile,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should fail gracefully (not throw) when sidesFile is a non-File value like a string", () => {
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: "not-a-file",
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Must be a File object");
      }
    });
  });

  describe("enrichment field truncation contract", () => {
    it("should accept priorSidesSummary exceeding 1500 characters (truncation is route-level, not schema-level)", () => {
      const longSummary = "X".repeat(2000);
      const validInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: longSummary,
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept priorBriefSummary exceeding 1500 characters (truncation is route-level, not schema-level)", () => {
      const longSummary = "Y".repeat(2000);
      const validInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: longSummary,
      };
      const result = auditionFormDataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should apply defaults for enrichment fields when absent", () => {
      const inputWithMissingEnrichment = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
      };
      const result = auditionFormDataSchema.safeParse(inputWithMissingEnrichment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priorSidesSummary).toBe("");
        expect(result.data.priorBriefSummary).toBe("");
      }
    });
  });

  describe("actorName validation", () => {
    it("should fail when actorName exceeds 200 characters", () => {
      const longName = "A".repeat(201);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: longName,
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("actorName");
      }
    });
  });

  describe("deadline and auditionTimezone validation", () => {
    it("should fail when deadline exceeds 50 characters", () => {
      const longDeadline = "A".repeat(51);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: longDeadline,
        auditionTimezone: undefined,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("deadline");
      }
    });

    it("should fail when auditionTimezone exceeds 50 characters", () => {
      const longTimezone = "B".repeat(51);
      const invalidInput = {
        projectType: "cinematic",
        project: "Test Project",
        role: "Test Role",
        actorName: "Actor",
        userPath: "user_path",
        sidesText: "",
        briefText: "",
        sidesFile: undefined,
        briefFile: undefined,
        deadline: undefined,
        auditionTimezone: longTimezone,
        priorSidesSummary: "",
        priorBriefSummary: "",
      };
      const result = auditionFormDataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("auditionTimezone");
      }
    });
  });
});
