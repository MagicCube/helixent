import { z } from "zod";

export const modelEntrySchema = z.object({
  name: z.string().min(1),
  baseURL: z.string().min(1),
  APIKey: z.string().min(1),
  /** Provider type: "openai" (default) or "anthropic". */
  provider: z.enum(["openai", "anthropic"]).optional().default("openai"),
});

export const helixentConfigSchema = z.object({
  models: z.array(modelEntrySchema).min(1),
  defaultModel: z.string().min(1).optional(),
}).superRefine((val, ctx) => {
  const seenNames = new Set<string>();
  for (const [index, model] of val.models.entries()) {
    if (seenNames.has(model.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate model name "${model.name}". Model names must be unique.`,
        path: ["models", index, "name"],
      });
    } else {
      seenNames.add(model.name);
    }
  }

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
