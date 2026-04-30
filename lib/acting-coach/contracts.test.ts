import { CoachReplyEnvelope, CoachApiResponse, CoachProfileUpdatePayload } from "./contracts";

describe("CoachAction discriminated union", () => {
  it("accepts trigger_dna_extraction action type", () => {
    const envelope: CoachReplyEnvelope = {
      reply: "test",
      session_focus: null,
      step_index: 0,
      mode: "guided",
      phase: null,
      action: { type: "trigger_dna_extraction", payload: {} },
    };
    expect(envelope.action && envelope.action.type).toBe("trigger_dna_extraction");
  });

  it("accepts update_actor_profile action type with bio payload", () => {
    const envelope: CoachReplyEnvelope = {
      reply: "test",
      session_focus: null,
      step_index: 0,
      mode: "guided",
      phase: null,
      action: { type: "update_actor_profile", payload: { bio: "test bio" } },
    };
    expect(envelope.action && envelope.action.type).toBe("update_actor_profile");
    expect(
      envelope.action && (envelope.action as { type: "update_actor_profile"; payload: { bio: string } }).payload.bio
    ).toBe("test bio");
  });

  it("narrows correctly in type guard for trigger_dna_extraction", () => {
    const action = { type: "trigger_dna_extraction", payload: {} } as CoachReplyEnvelope["action"];
    if (action && action.type === "trigger_dna_extraction") {
      expect(action.type).toBe("trigger_dna_extraction");
    }
  });

  it("narrows correctly in type guard for update_actor_profile", () => {
    const action = { type: "update_actor_profile", payload: { bio: "test" } } as CoachReplyEnvelope["action"];
    if (action && action.type === "update_actor_profile") {
      expect(action.type).toBe("update_actor_profile");
    }
  });

  it("action can be null", () => {
    const envelope: CoachReplyEnvelope = {
      reply: "test",
      session_focus: null,
      step_index: 0,
      mode: "guided",
      phase: null,
      action: null,
    };
    expect(envelope.action).toBeNull();
  });
});

describe("CoachApiResponse action field", () => {
  it("accepts update_actor_profile action in aiData", () => {
    const response: CoachApiResponse = {
      aiData: {
        coach_reply: "test reply",
        session_focus: null,
        step_index: 0,
        mode: "guided",
        phase: null,
        action: { type: "update_actor_profile", payload: { bio: "updated bio" } },
      },
    };
    expect(response.aiData.action?.type).toBe("update_actor_profile");
  });
});

describe("CoachProfileUpdatePayload excludes restricted fields", () => {
  it("does not include slug in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - slug is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { slug: "test" };
  });

  it("does not include status in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - status is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { status: "draft" };
  });

  it("does not include fullName in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - fullName is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { fullName: "Test" };
  });

  it("does not include agencyName in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - agencyName is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { agencyName: "Agency" };
  });

  it("does not include agencyEmail in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - agencyEmail is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { agencyEmail: "x@y.com" };
  });

  it("does not include agencyWebsite in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - agencyWebsite is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { agencyWebsite: "http://x.com" };
  });

  it("does not include agencyPhone in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - agencyPhone is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { agencyPhone: "123" };
  });

  it("does not include showContactPublicly in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - showContactPublicly is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { showContactPublicly: true };
  });

  it("does not include timezone in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - timezone is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { timezone: "UTC" };
  });

  it("does not include cvUrl in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - cvUrl is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { cvUrl: "http://cv.pdf" };
  });

  it("does not include cvFilename in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - cvFilename is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { cvFilename: "cv.pdf" };
  });

  it("does not include externalProfiles in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - externalProfiles is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { externalProfiles: {} };
  });

  it("does not include workPermits in CoachProfileUpdatePayload", () => {
    // @ts-expect-error - workPermits is restricted and should not be allowed
    const _: CoachProfileUpdatePayload = { workPermits: ["US"] };
  });

  it("allows coach-writable fields in CoachProfileUpdatePayload", () => {
    const payload: CoachProfileUpdatePayload = { bio: "test", headshot: "http://img.jpg" };
    expect(payload.bio).toBe("test");
    expect(payload.headshot).toBe("http://img.jpg");
  });
});
