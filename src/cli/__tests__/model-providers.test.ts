import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test } from "bun:test";
import { OpenAI } from "openai";

import { getDefaultModelOptions, MODEL_PROVIDERS } from "../model-providers";

const MINIMAX_OPENAI_PROVIDERS = [
  {
    label: "MiniMax (Domestic)",
    id: "minimax_cn",
    baseURL: "https://api.minimaxi.com/v1",
  },
  {
    label: "MiniMax (Global)",
    id: "minimax_global",
    baseURL: "https://api.minimax.io/v1",
  },
] as const;

const MINIMAX_ANTHROPIC_PROVIDERS = [
  {
    label: "MiniMax Anthropic (Domestic)",
    id: "minimax_anthropic_cn",
    baseURL: "https://api.minimaxi.com/anthropic",
  },
  {
    label: "MiniMax Anthropic (Global)",
    id: "minimax_anthropic_global",
    baseURL: "https://api.minimax.io/anthropic",
  },
] as const;

const MINIMAX_MODEL_IDS = ["MiniMax-M3", "MiniMax-M2.7"] as const;

describe("MiniMax providers", () => {
  test("use current endpoints and defaults", () => {
    for (const expected of MINIMAX_OPENAI_PROVIDERS) {
      expect(MODEL_PROVIDERS.find(({ id }) => id === expected.id)).toMatchObject({
        ...expected,
        providerType: "openai",
        defaultModelName: "MiniMax-M3",
      });
    }
    for (const expected of MINIMAX_ANTHROPIC_PROVIDERS) {
      expect(MODEL_PROVIDERS.find(({ id }) => id === expected.id)).toMatchObject({
        ...expected,
        providerType: "anthropic",
        defaultModelName: "MiniMax-M3",
      });
    }
  });

  test("use API-compatible thinking defaults", () => {
    expect(getDefaultModelOptions("MiniMax-M3", "openai")).toEqual({
      max_tokens: 16 * 1024,
      thinking: { type: "adaptive" },
    });
    expect(getDefaultModelOptions("MiniMax-M3", "anthropic")).toEqual({ max_tokens: 16 * 1024 });
    expect(getDefaultModelOptions("MiniMax-M2.7", "openai")).toEqual({ max_tokens: 16 * 1024 });
    expect(getDefaultModelOptions("MiniMax-M2.7", "anthropic")).toEqual({ max_tokens: 16 * 1024 });
    expect(getDefaultModelOptions("custom-model", "anthropic")).toEqual({
      max_tokens: 16 * 1024,
      thinking: { type: "enabled" },
    });
  });

  for (const provider of MINIMAX_OPENAI_PROVIDERS) {
    for (const model of MINIMAX_MODEL_IDS) {
      test(`${provider.id} sends ${model} to one /chat/completions path`, async () => {
        let requestURL = "";
        const client = new OpenAI({
          apiKey: "test-api-key",
          baseURL: provider.baseURL,
          fetch: async (input) => {
            requestURL = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            return new Response(
              JSON.stringify({
                id: "chatcmpl_test",
                object: "chat.completion",
                created: 0,
                model,
                choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              }),
              { headers: { "content-type": "application/json" } },
            );
          },
        });

        await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: "test" }],
        });

        expect(requestURL).toBe(`${provider.baseURL}/chat/completions`);
        expect(requestURL.match(/\/chat\/completions/g)).toHaveLength(1);
      });
    }
  }

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
