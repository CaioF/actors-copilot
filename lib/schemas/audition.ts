import { z } from "zod";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const auditionFileSchema = z.any()
  .superRefine((f, ctx) => {
    if (f == null) return; // undefined is allowed (.optional() below)
    if (!(f instanceof File)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a File object" });
      return; // stop further checks — avoid accessing File-specific properties
    }
    if (f.size > MAX_FILE_SIZE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "File exceeds 20MB limit" });
    }
    if (!ALLOWED_MIME_TYPES.includes(f.type) && !f.name.toLowerCase().endsWith(".docx")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Only PDFs and Word documents (.docx) are allowed" });
    }
  })
  .optional();

const enrichmentField = z.string().optional().default("");

export const auditionFormDataSchema = z.object({
  projectType: z.enum(["cinematic", "theater", "commercial"]).default("cinematic"),
  project: z.string().max(150).trim().optional().default(""),
  role: z.string().max(100).trim().optional().default(""),
  actorName: z.string().max(200).optional().default("Actor"),
  userPath: z.string().max(500),
  sidesText: z.string().optional().default(""),
  briefText: z.string().optional().default(""),
  sidesFile: auditionFileSchema,
  briefFile: auditionFileSchema,
  deadline: z.string().max(50).optional(),
  auditionTimezone: z.string().max(50).optional(),
  castingDirectorName: z.string().max(150).optional(),
  priorSidesSummary: enrichmentField,
  priorBriefSummary: enrichmentField,
});
