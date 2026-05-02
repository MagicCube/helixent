import { describe, expect, test } from "bun:test";

import { buildToolResultEnvelope, formatToolResultForMessage, inferToolErrorKind, normalizeToolResult } from "../tool-result-runtime";

describe("inferToolErrorKind", () => {
  test("maps common tool error code families", () => {
    expect(inferToolErrorKind("INVALID_PATH")).toBe("invalid_input");
    expect(inferToolErrorKind("DELETE_NOT_SUPPORTED")).toBe("unsupported");
    expect(inferToolErrorKind("FILE_NOT_FOUND")).toBe("not_found");
    expect(inferToolErrorKind("RG_NOT_FOUND")).toBe("environment_missing");
    expect(inferToolErrorKind("PATCH_APPLY_FAILED")).toBe("execution_failed");
  });
});

describe("normalizeToolResult", () => {
  test("preserves structured success results", () => {
    const result = normalizeToolResult({
      ok: true,
      summary: "Read file: /tmp/demo.ts",
      data: { path: "/tmp/demo.ts", content: "const x = 1;" },
    });

    expect(result).toMatchObject({
      ok: true,
      summary: "Read file: /tmp/demo.ts",
      data: { path: "/tmp/demo.ts", content: "const x = 1;" },
    });
  });

  test("preserves structured errors and infers error kind", () => {
    const result = normalizeToolResult({
      ok: false,
      summary: "File not found",
      error: "File not found",
      code: "FILE_NOT_FOUND",
    });

    expect(result).toMatchObject({
      ok: false,
      summary: "File not found",
      error: "File not found",
      code: "FILE_NOT_FOUND",
      errorKind: "not_found",
    });
  });

  test("normalizes legacy string errors", () => {
    const result = normalizeToolResult("Error: something failed");
    expect(result).toMatchObject({
      ok: false,
      summary: "something failed",
      error: "something failed",
    });
  });

  test("normalizes plain success strings", () => {
    const result = normalizeToolResult("done");
    expect(result).toMatchObject({
      ok: true,
      summary: "done",
      data: "done",
    });
  });
});


describe("buildToolResultEnvelope", () => {
  test("returns normalized result alongside transcript text", () => {
    const envelope = buildToolResultEnvelope({
      toolName: "grep_search",
      result: {
        ok: false,
        summary: "Failed to run rg",
        error: "Failed to run rg",
        code: "RG_NOT_FOUND",
      },
    });

    expect(envelope.normalized).toMatchObject({
      ok: false,
      code: "RG_NOT_FOUND",
      errorKind: "environment_missing",
    });
    expect(JSON.parse(envelope.transcript)).toEqual({
      ok: false,
      summary: "Failed to run rg",
      error: "Failed to run rg",
      code: "RG_NOT_FOUND",
    });
  });
});

describe("formatToolResultForMessage", () => {
  test("omits data for summary-first tools", () => {
    const formatted = formatToolResultForMessage({
      toolName: "list_files",
      result: {
        ok: true,
        summary: "Listed 5 entries under /tmp/demo",
        data: { entries: ["a", "b"] },
      },
    });

    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      summary: "Listed 5 entries under /tmp/demo",
    });
  });

  test("preserves data for content-carrying tools", () => {
    const formatted = formatToolResultForMessage({
      toolName: "read_file",
      result: {
        ok: true,
        summary: "Read file: /tmp/demo.ts",
        data: { path: "/tmp/demo.ts", content: "const x = 1;" },
      },
    });

    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      summary: "Read file: /tmp/demo.ts",
      data: { path: "/tmp/demo.ts", content: "const x = 1;" },
    });
  });

  test("passes through raw read_file text results", () => {
    const content = ["1: const x = 1;", "2: const y = 2;"].join("\n");
    const formatted = formatToolResultForMessage({
      toolName: "read_file",
      result: content,
    });

    expect(formatted).toBe(content);
  });

  test("passes through read_file text that starts with Error: verbatim", () => {
    const content = "Error: this line is part of the file";
    const formatted = formatToolResultForMessage({
      toolName: "read_file",
      result: content,
    });

    expect(formatted).toBe(content);
  });

  test("formats errors with stable structured shape", () => {
    const formatted = formatToolResultForMessage({
      toolName: "grep_search",
      result: {
        ok: false,
        summary: "Failed to run rg",
        error: "Failed to run rg",
        code: "RG_NOT_FOUND",
      },
    });

    expect(JSON.parse(formatted)).toEqual({
      ok: false,
      summary: "Failed to run rg",
      error: "Failed to run rg",
      code: "RG_NOT_FOUND",
    });
  });

  test("compacts oversized structured data before transcript serialization", () => {
    const formatted = formatToolResultForMessage({
      toolName: "grep_search",
      result: {
        ok: true,
        summary: "Found 40 matches for foo",
        data: {
          matches: Array.from({ length: 20 }, (_, i) => `match-${i}`),
          content: "x".repeat(5000),
        },
      },
    });

    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      summary: "Found 40 matches for foo",
    });
  });

  test("always returns valid json when payload exceeds limits", () => {
    const formatted = formatToolResultForMessage({
      toolName: "apply_patch",
      result: {
        ok: true,
        summary: "Applied patch",
        data: { patch: "x".repeat(10000) },
      },
    });

    expect(() => JSON.parse(formatted)).not.toThrow();
    expect(JSON.parse(formatted)).toEqual({
      ok: true,
      summary: "Applied patch",
    });
  });
});
