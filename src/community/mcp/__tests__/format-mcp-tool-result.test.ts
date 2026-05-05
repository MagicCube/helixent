import { describe, expect, test } from "bun:test";

import { formatMcpCallToolResult } from "../format-mcp-tool-result";

describe("formatMcpCallToolResult", () => {
  test("joins text blocks", () => {
    const out = formatMcpCallToolResult({
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    } as never);
    expect(out).toBe("hello\n\nworld");
  });

  test("includes structuredContent when present", () => {
    const out = formatMcpCallToolResult({
      content: [{ type: "text", text: "ok" }],
      structuredContent: { a: 1 },
    } as never);
    expect(out).toContain("ok");
    expect(out).toContain('"a": 1');
  });

  test("formats toolResult branch", () => {
    expect(formatMcpCallToolResult({ toolResult: "plain" } as never)).toBe("plain");
    expect(formatMcpCallToolResult({ toolResult: { x: 1 } } as never)).toBe(JSON.stringify({ x: 1 }, null, 2));
  });
});
