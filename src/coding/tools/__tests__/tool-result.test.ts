import { describe, expect, test } from "bun:test";

import { errorToolResult, okToolResult } from "../tool-result";

describe("okToolResult", () => {
  test("returns success result with data", () => {
    const result = okToolResult("done", { value: 42 });
    expect(result).toEqual({
      ok: true,
      summary: "done",
      data: { value: 42 },
    });
  });

  test("returns success result without data when data is undefined", () => {
    const result = okToolResult("done", undefined);
    expect(result).toEqual({
      ok: true,
      summary: "done",
      data: undefined,
    });
  });
});

describe("errorToolResult", () => {
  test("returns error result with code and details", () => {
    const result = errorToolResult("file not found", "FILE_NOT_FOUND", { path: "/tmp/x" });
    expect(result).toEqual({
      ok: false,
      summary: "file not found",
      error: "file not found",
      code: "FILE_NOT_FOUND",
      details: { path: "/tmp/x" },
    });
  });

  test("returns error result without code", () => {
    const result = errorToolResult("something failed");
    expect(result).toEqual({
      ok: false,
      summary: "something failed",
      error: "something failed",
    });
    expect(result).not.toHaveProperty("code");
    expect(result).not.toHaveProperty("details");
  });

  test("returns error result with code but no details", () => {
    const result = errorToolResult("denied", "PERMISSION_DENIED");
    expect(result).toEqual({
      ok: false,
      summary: "denied",
      error: "denied",
      code: "PERMISSION_DENIED",
    });
    expect(result).not.toHaveProperty("details");
  });
});
