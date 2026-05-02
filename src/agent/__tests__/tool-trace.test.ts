import { describe, expect, test } from "bun:test";

import { appendToolTrace, createToolInputSignature, createToolTraceState, summarizeRecentToolTrace } from "../tool-trace";

describe("createToolInputSignature", () => {
  test("serializes json-safe input", () => {
    expect(createToolInputSignature({ path: "/tmp/demo.ts", count: 1 })).toBe('{"path":"/tmp/demo.ts","count":1}');
  });
});

describe("appendToolTrace", () => {
  test("detects repeated identical failures", () => {
    const state = createToolTraceState();
    appendToolTrace(state, {
      step: 1,
      toolName: "read_file",
      toolUseId: "toolu_1",
      inputSignature: '{"path":"/tmp/missing.ts"}',
      ok: false,
      summary: "File not found",
      code: "FILE_NOT_FOUND",
      errorKind: "not_found",
    });

    const second = appendToolTrace(state, {
      step: 2,
      toolName: "read_file",
      toolUseId: "toolu_2",
      inputSignature: '{"path":"/tmp/missing.ts"}',
      ok: false,
      summary: "File not found",
      code: "FILE_NOT_FOUND",
      errorKind: "not_found",
    });

    expect(second.repeatedFailure).toBe(true);
    expect(state.repeatedFailureCount).toBe(1);
  });

  test("evicts old entries beyond the recent window", () => {
    const state = createToolTraceState();
    for (let i = 0; i < 4; i++) {
      appendToolTrace(state, {
        step: i + 1,
        toolName: "list_files",
        toolUseId: `toolu_${i}`,
        inputSignature: String(i),
        ok: true,
        summary: `ok-${i}`,
      }, 2);
    }

    expect(state.recent).toHaveLength(2);
    expect(state.recent.map((entry) => entry.summary)).toEqual(["ok-2", "ok-3"]);
  });
});

describe("summarizeRecentToolTrace", () => {
  test("returns recent failure summary", () => {
    const state = createToolTraceState();
    appendToolTrace(state, {
      step: 1,
      toolName: "read_file",
      toolUseId: "toolu_1",
      inputSignature: '{"path":"/tmp/missing.ts"}',
      ok: false,
      summary: "File not found",
      code: "FILE_NOT_FOUND",
      errorKind: "not_found",
    });
    appendToolTrace(state, {
      step: 2,
      toolName: "list_files",
      toolUseId: "toolu_2",
      inputSignature: '{"path":"/tmp"}',
      ok: true,
      summary: "Listed files",
    });

    expect(summarizeRecentToolTrace(state)).toEqual({
      totalRecent: 2,
      repeatedFailureCount: 0,
      latestFailures: [
        {
          toolName: "read_file",
          summary: "File not found",
          code: "FILE_NOT_FOUND",
          errorKind: "not_found",
          repeatedFailure: false,
        },
      ],
    });
  });
});
