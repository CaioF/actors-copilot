import { SchemaType } from "firebase/ai";

export const COACH_REPLY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
    session_focus: { type: SchemaType.STRING, nullable: true },
    step_index: { type: SchemaType.INTEGER },
    mode: { type: SchemaType.STRING, enum: ["guided", "informational", "transition"] },
    phase: { type: SchemaType.STRING, nullable: true },
  },
  required: ["reply", "step_index", "mode"],
};
