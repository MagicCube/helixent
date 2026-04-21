import { describe, expect, test } from "bun:test";

import { CODING_TOOLS_REQUIRING_APPROVAL } from "../requires-approval";

describe("CODING_TOOLS_REQUIRING_APPROVAL", () => {
  test("contains expected tool names", () => {
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("bash");
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("write_file");
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("str_replace");
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("apply_patch");
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("mkdir");
    expect(CODING_TOOLS_REQUIRING_APPROVAL).toContain("move_path");
  });

  test("is a non-empty array", () => {
    expect(Array.isArray(CODING_TOOLS_REQUIRING_APPROVAL)).toBe(true);
    expect(CODING_TOOLS_REQUIRING_APPROVAL.length).toBeGreaterThan(0);
  });

  test("has no duplicate entries", () => {
    const unique = new Set(CODING_TOOLS_REQUIRING_APPROVAL);
    expect(unique.size).toBe(CODING_TOOLS_REQUIRING_APPROVAL.length);
  });
});
