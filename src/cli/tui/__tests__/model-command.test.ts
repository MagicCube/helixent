import { describe, expect, it } from "bun:test";

import type { ModelEntry } from "@/cli/config";

import { resolveModelSelection } from "../model-command";

const models: ModelEntry[] = [
  {
    name: "deepseek-v4-flash",
    baseURL: "https://api.deepseek.com/v1",
    APIKey: "key",
    provider: "openai",
  },
  {
    name: "deepseek-v4-pro",
    baseURL: "https://api.deepseek.com/v1",
    APIKey: "key",
    provider: "openai",
  },
];

describe("resolveModelSelection", () => {
  it("selects a different configured model", () => {
    const result = resolveModelSelection({
      models,
      currentModelName: "deepseek-v4-flash",
      targetName: "deepseek-v4-pro",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Switched model");
    if (result.ok) {
      expect(result.entry.name).toBe("deepseek-v4-pro");
    }
  });

  it("rejects an unknown model without selecting one", () => {
    const result = resolveModelSelection({
      models,
      currentModelName: "deepseek-v4-flash",
      targetName: "unknown",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("rejects the current model", () => {
    const result = resolveModelSelection({
      models,
      currentModelName: "deepseek-v4-flash",
      targetName: "deepseek-v4-flash",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Already using");
  });
});
