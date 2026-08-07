import type { z } from "zod";

/**
 * A function tool that can be used to invoke a function.
 * @param P - The parameters of the tool.
 * @param R - The result of the tool.
 */
export interface FunctionTool<
  P extends z.ZodSchema<Record<string, unknown>> = z.ZodSchema<Record<string, unknown>>,
  R = unknown,
> {
  /** The name of the tool. */
  name: string;
  /** The description of the tool. */
  description: string;
  /** The parameters of the tool. */
  parameters: P;
  /** The function to invoke when the tool is called. */
  // eslint-disable-next-line no-unused-vars
  invoke: (input: z.infer<P>, signal?: AbortSignal) => Promise<R>;
}

/**
 * Defines a function tool.
 *
 * The schema is not only model-facing metadata. Tool input originates from a
 * runtime model response, so every invocation is parsed before the user
 * implementation runs. This keeps the implementation's inferred input type
 * true at runtime and applies any schema transforms consistently.
 */
export function defineTool<P extends z.ZodSchema<Record<string, unknown>>, R>({
  name,
  description,
  parameters,
  invoke,
}: {
  name: string;
  description: string;
  parameters: P;
  // eslint-disable-next-line no-unused-vars
  invoke: (input: z.infer<P>, signal?: AbortSignal) => Promise<R>;
}): FunctionTool<P, R> {
  return {
    name,
    description,
    parameters,
    invoke: async (input, signal) => {
      const validatedInput = parameters.parse(input);
      return invoke(validatedInput, signal);
    },
  } as FunctionTool<P, R>;
}
