import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test } from "bun:test";

import { MODEL_PROVIDERS } from "../model-providers";

const MINIMAX_ANTHROPIC_PROVIDERS = [
  {
    id: "minimax_anthropic_cn",
    baseURL: "https://api.minimaxi.com/anthropic",
  },
  {
    id: "minimax_anthropic_global",
    baseURL: "https://api.minimax.io/anthropic",
  },
] as const;

const MINIMAX_MODEL_IDS = ["MiniMax-M3", "MiniMax-M2.7"] as const;

describe("MiniMax Anthropic providers", () => {
  test("use SDK-compatible base URLs", () => {
    for (const expected of MINIMAX_ANTHROPIC_PROVIDERS) {
      expect(MODEL_PROVIDERS.find(({ id }) => id === expected.id)).toMatchObject({
        ...expected,
        providerType: "anthropic",
        defaultModelName: "MiniMax-M3",
      });
    }
  });

  for (const provider of MINIMAX_ANTHROPIC_PROVIDERS) {
    for (const model of MINIMAX_MODEL_IDS) {
      test(`${provider.id} sends ${model} to one /v1/messages path`, async () => {
        let requestURL = "";
        const client = new Anthropic({
          apiKey: "test-api-key",
          baseURL: provider.baseURL,
          fetch: async (input) => {
            requestURL = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            return new Response(
              JSON.stringify({
                id: "msg_test",
                type: "message",
                role: "assistant",
                model,
                content: [],
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
              { headers: { "content-type": "application/json" } },
            );
          },
        });

        await client.messages.create({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        });

        expect(requestURL).toBe(`${provider.baseURL}/v1/messages`);
        expect(requestURL.match(/\/v1\/messages/g)).toHaveLength(1);
      });
    }
  }
});
