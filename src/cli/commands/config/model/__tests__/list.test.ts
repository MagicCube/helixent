import { describe, expect, test } from "bun:test";

import { maskApiKey } from "../list";

describe("maskApiKey", () => {
  test("fully masks keys that are four characters or shorter", () => {
    expect(maskApiKey("a")).toBe("****");
    expect(maskApiKey("abcd")).toBe("****");
    expect(maskApiKey("abcd")).not.toContain("abcd");
  });

  test("shows only the last four characters of longer keys", () => {
    expect(maskApiKey("sk-secret-1234")).toBe("****1234");
    expect(maskApiKey("sk-secret-1234")).not.toContain("secret");
  });
});
