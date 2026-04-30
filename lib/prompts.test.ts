import { ACTING_COACH_SYSTEM_PROMPT } from "./prompts";

describe("ACTING_COACH_SYSTEM_PROMPT", () => {
  it("contains update_actor_profile action", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain("update_actor_profile");
  });

  it("lists bio as a writable field", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain("bio");
  });

  it("lists headshot as a writable field", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain("headshot");
  });

  it("lists credits as a writable field", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain("credits");
  });

  it("describes trigger condition for explicit actor request", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toMatch(/explicit.*actor.*request|actor.*request.*explicit/i);
  });

  it("describes that update_actor_profile fires only on explicit actor confirmation", () => {
    const actionSection = ACTING_COACH_SYSTEM_PROMPT.match(/# ACTION[\s\S]*?(?=# FORMAT)/);
    expect(actionSection?.[0]).toMatch(/only.*explicit|explicit.*only|actor.*confirm|confirm.*actor/i);
  });

  it("instructs that array fields are replaced, not appended", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toMatch(/replac|not.*append|full.*array|entire.*array/i);
  });

  it("shows update_actor_profile example in FORMAT section", () => {
    const formatSection = ACTING_COACH_SYSTEM_PROMPT.match(/# FORMAT[\s\S]*/);
    expect(formatSection?.[0]).toContain("update_actor_profile");
  });

  it("leaves trigger_dna_extraction unchanged", () => {
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain("trigger_dna_extraction");
    expect(ACTING_COACH_SYSTEM_PROMPT).toContain('trigger_dna_extraction", payload: {}');
  });
});
