import { describe, expect, test } from "bun:test";

import { summarizeToolResultText } from "../tool-result-summary";

describe("summarizeToolResultText", () => {
  describe("error prefix passthrough", () => {
    test("returns content as-is when it starts with 'Error:'", () => {
      expect(summarizeToolResultText("Error: something went wrong")).toBe("Error: something went wrong");
    });

    test("returns content as-is for 'Error:' with no additional text", () => {
      expect(summarizeToolResultText("Error:")).toBe("Error:");
    });
  });

  describe("JSON success path", () => {
    test("returns summary when ok is true and summary is a string", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: true, summary: "3 files found" }))).toBe("3 files found");
    });

    test("returns null when ok is true but summary is not a string", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: true, summary: 42 }))).toBeNull();
    });

    test("returns null when ok is true but summary is missing", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: true }))).toBeNull();
    });
  });

  describe("JSON error path", () => {
    test("returns formatted error with code when ok is false", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: false, error: "not found", code: "FILE_NOT_FOUND" }))).toBe(
        "Error [FILE_NOT_FOUND]: not found",
      );
    });

    test("prefers summary over error for the message when ok is false", () => {
      expect(
        summarizeToolResultText(JSON.stringify({ ok: false, summary: "custom msg", error: "raw error", code: "E1" })),
      ).toBe("Error [E1]: custom msg");
    });

    test("falls back to error string when summary is not a string and ok is false", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: false, error: "fail", code: "E2" }))).toBe(
        "Error [E2]: fail",
      );
    });

    test("returns formatted error without code when ok is false and code is missing", () => {
      expect(summarizeToolResultText(JSON.stringify({ ok: false, summary: "bad input" }))).toBe("Error: bad input");
    });

    test("returns formatted error using raw content when neither summary nor error is a string", () => {
      const raw = JSON.stringify({ ok: false, summary: 123, error: 456 });
      expect(summarizeToolResultText(raw)).toBe(`Error: ${raw}`);
    });
  });

  describe("non-JSON content", () => {
    test("returns null for plain text that is not an error", () => {
      expect(summarizeToolResultText("some plain text output")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(summarizeToolResultText("")).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      expect(summarizeToolResultText("{not valid json}")).toBeNull();
    });

    test("returns null for JSON with neither ok true nor ok false", () => {
      expect(summarizeToolResultText(JSON.stringify({ data: "stuff" }))).toBeNull();
    });
  });
});
