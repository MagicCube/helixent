import { describe, expect, test } from "bun:test";

import { defaultModelOptions } from "../model-options";

describe("defaultModelOptions", () => {
  test("uses conservative defaults without forcing a model-specific thinking mode", () => {
    const options = defaultModelOptions();

    expect(options).toEqual({ max_tokens: 16 * 1024 });
    expect(options).not.toHaveProperty("thinking");
    expect(options).not.toHaveProperty("temperature");
    expect(options).not.toHaveProperty("top_p");
    expect(options).not.toHaveProperty("top_k");
  });
});
