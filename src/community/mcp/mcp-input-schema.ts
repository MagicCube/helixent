import type { ZodType } from "zod";
import z from "zod";

/**
 * Convert an MCP tool `inputSchema` (JSON Schema) into a Zod schema for {@link defineTool}.
 * Falls back to a permissive object schema when conversion fails.
 */
export function mcpInputSchemaToZod(inputSchema: Record<string, unknown>): ZodType<Record<string, unknown>> {
  try {
    const schema = z.fromJSONSchema(inputSchema);
    return schema as ZodType<Record<string, unknown>>;
  } catch {
    return z.object({}).passthrough();
  }
}
