import { describe, expect, test } from "bun:test";

import { getToolRecoveryHint } from "../tool-recovery-policy";

describe("getToolRecoveryHint", () => {
  test("maps invalid path on file tools to discovery guidance", () => {
    expect(getToolRecoveryHint({ toolName: "read_file", code: "INVALID_PATH", errorKind: "invalid_input" })).toEqual({
      message: "The target path could not be used. Discover the correct path before retrying.",
      suggestedTools: ["list_files", "glob_search"],
      shouldSuppressImmediateRetry: true,
      retryable: false,
    });
  });

  test("maps patch apply failure to reread guidance", () => {
    expect(getToolRecoveryHint({ toolName: "apply_patch", code: "PATCH_APPLY_FAILED", errorKind: "execution_failed" })).toEqual({
      message: "Patch application failed. Re-read the file and verify the target lines before trying another edit.",
      suggestedTools: ["read_file"],
      shouldSuppressImmediateRetry: true,
      retryable: false,
    });
  });

  test("treats missing environment tools as non-retryable", () => {
    expect(getToolRecoveryHint({ toolName: "grep_search", code: "RG_NOT_FOUND", errorKind: "environment_missing" })).toEqual({
      message: "Required environment dependency is missing. Do not blindly retry the same tool call.",
      shouldSuppressImmediateRetry: true,
      retryable: false,
    });
  });

  test("provides generic guidance for unknown failures", () => {
    expect(getToolRecoveryHint({ toolName: "write_file", errorKind: "unknown" })).toEqual({
      message: "Tool call failed. Inspect the previous result before retrying the same action.",
      shouldSuppressImmediateRetry: false,
      retryable: false,
    });
  });
});
