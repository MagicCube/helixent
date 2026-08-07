import { describe, expect, test } from "bun:test";

import { OpenAIModelProvider } from "../model-provider";

describe("OpenAIModelProvider request options", () => {
  test("does not inject temperature when the caller does not request it", async () => {
    const provider = new OpenAIModelProvider({ apiKey: "test-key" });
    let captured: Record<string, unknown> | undefined;

    provider._client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            captured = params;
            return {
              choices: [{ message: { role: "assistant", content: "ok" } }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            };
          },
        },
      },
    } as never;

    await provider.invoke({ model: "compatible-model", messages: [] });

    expect(captured).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(captured, "temperature")).toBe(false);
  });

  test("passes an explicit caller temperature through unchanged", async () => {
    const provider = new OpenAIModelProvider({ apiKey: "test-key" });
    let captured: Record<string, unknown> | undefined;

    provider._client = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            captured = params;
            return {
              choices: [{ message: { role: "assistant", content: "ok" } }],
            };
          },
        },
      },
    } as never;

    await provider.invoke({
      model: "compatible-model",
      messages: [],
      options: { temperature: 0.7 },
    });

    expect(captured?.temperature).toBe(0.7);
  });
});
