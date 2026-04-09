import { z } from "zod";

export const modelEntrySchema = z.object({
  name: z.string().min(1),
  baseURL: z.string().min(1),
  APIKey: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const helixentConfigSchema = z.object({
  models: z.array(modelEntrySchema).min(1),
  defaultModel: z.string().min(1).optional(),
}).superRefine((val, ctx) => {
  if (val.defaultModel && !val.models.some((m) => m.name === val.defaultModel)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `defaultModel "${val.defaultModel}" does not match any configured model name`,
      path: ["defaultModel"],
    });
  }
});

export type HelixentConfig = z.infer<typeof helixentConfigSchema>;
export type ModelEntry = z.infer<typeof modelEntrySchema>;
