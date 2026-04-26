import { describe, expect, test } from "bun:test";

import { defineTool } from "../tools/function-tool";
import type { StructuredToolResult } from "../tools/structured-tool-result";

describe("defineTool", () => {
  test("creates a tool with the given name, description, and parameters", () => {
    const tool = defineTool({
      name: "test_tool",
      description: "A test tool",
      parameters: { parse: () => ({}) } as never,
      invoke: async () => "result",
    });

    expect(tool.name).toBe("test_tool");
    expect(tool.description).toBe("A test tool");
  });

  test("invoke calls the provided function with input", async () => {
    const tool = defineTool({
      name: "echo",
      description: "Echoes input",
      parameters: { parse: () => ({}) } as never,
      invoke: async (input) => JSON.stringify(input),
    });

    const result = await tool.invoke({ message: "hello" } as never);
    expect(result).toBe('{"message":"hello"}');
  });

  test("invoke passes abort signal when provided", async () => {
    const ac = new AbortController();
    ac.abort();

    const tool = defineTool({
      name: "slow",
      description: "Slow tool",
      parameters: { parse: () => ({}) } as never,
      invoke: async (_input, signal) => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        return "done";
      },
    });

    await expect(tool.invoke({} as never, ac.signal)).rejects.toThrow("Aborted");
  });
});

describe("StructuredToolResult types", () => {
  test("success result shape is valid", () => {
    const result: StructuredToolResult<string> = {
      ok: true,
      summary: "done",
      data: "payload",
    };
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("done");
    expect(result.data).toBe("payload");
  });

  test("error result shape is valid", () => {
    const result: StructuredToolResult = {
      ok: false,
      summary: "failed",
      error: "failed",
      code: "ERR",
      details: { path: "/tmp" },
    };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ERR");
    expect(result.details).toEqual({ path: "/tmp" });
  });

  test("error result without optional fields is valid", () => {
    const result: StructuredToolResult = {
      ok: false,
      summary: "oops",
      error: "oops",
    };
    expect(result.ok).toBe(false);
    expect(result.code).toBeUndefined();
    expect(result.details).toBeUndefined();
  });
});
