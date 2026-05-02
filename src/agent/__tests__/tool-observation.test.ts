import { describe, expect, test } from "bun:test";

import { buildRecentToolObservation } from "../tool-observation";
import type { ToolTraceRecord, ToolTraceState } from "../tool-trace";

function makeState(records: ToolTraceRecord[]): ToolTraceState {
  return {
    recent: records,
    repeatedFailureCount: records.filter((r) => r.repeatedFailure).length,
  };
}

describe("buildRecentToolObservation", () => {
  test("returns null when there are no failures", () => {
    const state = makeState([
      {
        step: 1,
        toolName: "list_files",
        toolUseId: "t1",
        inputSignature: "{}",
        ok: true,
        summary: "ok",
        repeatedFailure: false,
      },
    ]);

    const observation = buildRecentToolObservation({
      state,
      getRecoveryHint: () => null,
    });

    expect(observation).toBeNull();
  });

  test("includes a summary line and avoid_immediate_retry_tools for repeated failures", () => {
    const failure: ToolTraceRecord = {
      step: 2,
      toolName: "grep_search",
      toolUseId: "t2",
      inputSignature: "{\"pattern\":\"foo\"}",
      ok: false,
      summary: "rg not found",
      code: "RG_NOT_FOUND",
      errorKind: "environment_missing",
      repeatedFailure: true,
    };

    const state = makeState([failure]);
    const observation = buildRecentToolObservation({
      state,
      getRecoveryHint: () => ({
        message: "Missing env",
        shouldSuppressImmediateRetry: true,
        retryable: false,
      }),
    });

    expect(observation).toContain("<tool_observation>");
    expect(observation).toContain("summary: recent_failures=1");
    expect(observation).toContain("repeated_failures=1");
    expect(observation).toContain("avoid_immediate_retry_tools=grep_search");
    expect(observation).toContain("repeated_failure=true");
    expect(observation).toContain("avoid_immediate_retry=true");
    expect(observation).toContain("code=RG_NOT_FOUND");
    expect(observation).toContain("kind=environment_missing");
  });

  test("dedupes identical failures and prioritizes repeated failures over newer non-repeated ones", () => {
    const a1: ToolTraceRecord = {
      step: 1,
      toolName: "apply_patch",
      toolUseId: "t1",
      inputSignature: "{\"patch\":\"...\"}",
      ok: false,
      summary: "Patch failed",
      code: "PATCH_APPLY_FAILED",
      errorKind: "execution_failed",
      repeatedFailure: false,
    };

    const a2: ToolTraceRecord = {
      ...a1,
      step: 2,
      toolUseId: "t2",
      repeatedFailure: true,
    };

    const newerNonRepeated: ToolTraceRecord = {
      step: 3,
      toolName: "glob_search",
      toolUseId: "t3",
      inputSignature: "{\"pattern\":\"bar\"}",
      ok: false,
      summary: "glob failed",
      code: "FILE_NOT_FOUND",
      errorKind: "not_found",
      repeatedFailure: false,
    };

    const state = makeState([a1, a2, newerNonRepeated]);
    const observation = buildRecentToolObservation({
      state,
      getRecoveryHint: () => null,
      maxFailures: 3,
    });

    expect(observation).toContain("summary: recent_failures=3");
    // Dedup should keep one formatted line for these identical failures.
    expect(observation?.match(/tool=apply_patch/g)?.length).toBe(1);
    expect(observation).toContain("repeated_failure=true");
  });
});

