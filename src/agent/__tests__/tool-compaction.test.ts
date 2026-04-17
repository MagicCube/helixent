import { describe, expect, test } from "bun:test";

import { compactToolResultData, compactTranscriptPayload } from "../tool-compaction";
import { getToolResultPolicy } from "../tool-result-policy";

describe("compactToolResultData", () => {
  test("truncates large strings in success data", () => {
    const result = compactToolResultData({
      toolName: "apply_patch",
      normalized: {
        ok: true,
        summary: "Applied patch",
        data: { patch: "x".repeat(1200) },
        raw: null,
      },
      policy: getToolResultPolicy("apply_patch"),
    });

    expect(result).toEqual({
      ok: true,
      summary: "Applied patch",
      data: {
        patch: expect.stringContaining("[truncated"),
      },
    });
  });

  test("samples long arrays", () => {
    const result = compactToolResultData({
      toolName: "list_files",
      normalized: {
        ok: true,
        summary: "Listed files",
        data: { entries: Array.from({ length: 25 }, (_, i) => `file-${i}`) },
        raw: null,
      },
      policy: getToolResultPolicy("list_files"),
    });

    expect(result).toEqual({
      ok: true,
      summary: "Listed files",
      data: {
        entries: {
          items: Array.from({ length: 10 }, (_, i) => `file-${i}`),
          truncated: true,
          originalLength: 25,
        },
      },
    });
  });
});

describe("compactTranscriptPayload", () => {
  test("drops data for summary-first tools", () => {
    const result = compactTranscriptPayload({
      toolName: "grep_search",
      normalized: {
        ok: true,
        summary: "Found 42 matches",
        data: { matches: Array.from({ length: 15 }, (_, i) => `match-${i}`) },
        raw: null,
      },
      policy: getToolResultPolicy("grep_search"),
    });

    expect(result).toEqual({
      ok: true,
      summary: "Found 42 matches",
    });
  });

  test("preserves compacted details for errors", () => {
    const result = compactTranscriptPayload({
      toolName: "grep_search",
      normalized: {
        ok: false,
        summary: "grep failed",
        error: "x".repeat(1200),
        code: "GREP_FAILED",
        details: { stderr: "y".repeat(1200) },
        errorKind: "execution_failed",
        raw: null,
      },
      policy: getToolResultPolicy("grep_search"),
    });

    expect(result).toEqual({
      ok: false,
      summary: "grep failed",
      error: expect.stringContaining("[truncated"),
      code: "GREP_FAILED",
      details: {
        stderr: expect.stringContaining("[truncated"),
      },
    });
  });
});
