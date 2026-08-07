import { describe, expect, test } from "bun:test";

import { defaultModelOptionsForProvider } from "../model-options";

describe("defaultModelOptionsForProvider", () => {
  test("does not send Anthropic thinking options to OpenAI-compatible providers", () => {
    const options = defaultModelOptionsForProvider("openai");

    expect(options).toEqual({ max_tokens: 16 * 1024 });
    expect(options).not.toHaveProperty("thinking");
  });

  test("enables thinking for Anthropic providers", () => {
    expect(defaultModelOptionsForProvider("anthropic")).toEqual({
      max_tokens: 16 * 1024,
      thinking: {
        type: "enabled",
      },
    });
  });
});
