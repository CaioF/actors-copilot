import { SchemaType } from "firebase/ai";
import { COACH_REPLY_SCHEMA } from "./coach-reply-schema";

describe("COACH_REPLY_SCHEMA", () => {
  it("has action property of type OBJECT with nullable true", () => {
    expect(COACH_REPLY_SCHEMA.properties.action).toBeDefined();
    expect(COACH_REPLY_SCHEMA.properties.action.type).toBe(SchemaType.OBJECT);
    expect(COACH_REPLY_SCHEMA.properties.action.nullable).toBe(true);
  });

  it("action is NOT in required array", () => {
    expect(COACH_REPLY_SCHEMA.required).not.toContain("action");
  });

  it("action.properties contains only type", () => {
    const actionProps = COACH_REPLY_SCHEMA.properties.action.properties;
    expect(Object.keys(actionProps)).toEqual(["type"]);
    expect(actionProps.type.type).toBe(SchemaType.STRING);
  });
});
