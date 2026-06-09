describe("ActingCoachConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("when required environment variables are missing", () => {
    it("throws a descriptive error when ACTING_COACH_GENERATION_MODEL is missing", () => {
      delete process.env.ACTING_COACH_GENERATION_MODEL;

      expect(() => {
        require("./config").getActingCoachConfig();
      }).toThrow(/ACTING_COACH_GENERATION_MODEL/i);
    });
  });

  describe("when all required environment variables are present", () => {
    beforeEach(() => {
      process.env.ACTING_COACH_GENERATION_MODEL = "gemini-2.0-flash";
    });

    it("parses env values into a typed config object", () => {
      const config = require("./config").getActingCoachConfig();
      expect(config.generationModel).toBe("gemini-2.0-flash");
    });

    it("does not require retrieval env vars for chat runtime config", () => {
      process.env = { ACTING_COACH_GENERATION_MODEL: "gemini-2.0-flash" } as unknown as NodeJS.ProcessEnv;

      const config = require("./config").getActingCoachConfig();
      expect(config).toEqual({ generationModel: "gemini-2.0-flash" });
    });

    it("does not include Google Cloud fields", () => {
      const config = require("./config").getActingCoachConfig();
      expect((config as Record<string, unknown>).googleCloudProject).toBeUndefined();
      expect((config as Record<string, unknown>).googleCloudLocation).toBeUndefined();
    });

    it("caches the config so subsequent calls return the same object", () => {
      const { getActingCoachConfig } = require("./config");
      const config1 = getActingCoachConfig();
      const config2 = getActingCoachConfig();
      expect(config1).toBe(config2);
    });
  });

});
