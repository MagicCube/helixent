import { describe, expect, test } from "bun:test";

import { defaultModelOptionsForProvider } from "../model-options";

describe("defaultModelOptionsForProvider", () => {
  test("does not send Anthropic thinking options to OpenAI-compatible providers", () => {
    const options = defaultModelOptionsForProvider("openai");

    expect(options).toEqual({ max_tokens: 16 * 1024 });
    expect(options).not.toHaveProperty("thinking");
  });

  test("enables Anthropic thinking with a valid explicit budget", () => {
    const options = defaultModelOptionsForProvider("anthropic");

    expect(options).toEqual({
      max_tokens: 16 * 1024,
      thinking: {
        type: "enabled",
        budget_tokens: 8 * 1024,
      },
    });

    const thinking = options.thinking as { budget_tokens: number };
    expect(thinking.budget_tokens).toBeGreaterThanOrEqual(1024);
    expect(thinking.budget_tokens).toBeLessThan(options.max_tokens as number);
  });
});
