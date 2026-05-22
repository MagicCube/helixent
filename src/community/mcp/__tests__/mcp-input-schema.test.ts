import { describe, expect, test } from "bun:test";

import { mcpInputSchemaToZod } from "../mcp-input-schema";

describe("mcpInputSchemaToZod", () => {
  test("converts a simple object schema", () => {
    const zod = mcpInputSchemaToZod({
      type: "object",
      properties: { x: { type: "string" } },
      required: ["x"],
    });
    expect(zod.safeParse({ x: "a" }).success).toBe(true);
    expect(zod.safeParse({}).success).toBe(false);
  });

  test("falls back on invalid schema", () => {
    const zod = mcpInputSchemaToZod({ notValid: true } as Record<string, unknown>);
    expect(zod.safeParse({ any: "thing" }).success).toBe(true);
  });
});
