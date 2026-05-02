import { describe, expect, test } from "bun:test";
import z from "zod";

import type { AssistantMessage, ModelProvider, ModelProviderInvokeParams } from "@/foundation";
import { defineTool } from "@/foundation";
import { Model } from "@/foundation/models";

import { Agent } from "../agent";

class RecordingProvider implements ModelProvider {
  calls: ModelProviderInvokeParams[] = [];
  private readonly responses: AssistantMessage[];

  constructor(responses: AssistantMessage[]) {
    this.responses = responses;
  }

  async invoke(): Promise<AssistantMessage> {
    throw new Error("invoke not implemented in test provider");
  }

  async *stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    this.calls.push(params);
    const next = this.responses[this.calls.length - 1];
    if (!next) {
      throw new Error(`Unexpected model stream call #${this.calls.length}`);
    }
    yield next;
  }
}

function getSystemPromptText(call: ModelProviderInvokeParams) {
  const first = call.messages[0];
  if (!first || first.role !== "system") {
    throw new Error("Expected first message to be a system prompt");
  }

  const textBlock = first.content[0];
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Expected first system content block to be text");
  }

  return textBlock.text;
}

describe("Agent tool observation injection", () => {
  test("injects tool observation immediately after the first failure and upgrades it after repeated failure", async () => {
    const provider = new RecordingProvider([
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "grep_search",
            input: { pattern: "foo" },
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_2",
            name: "grep_search",
            input: { pattern: "foo" },
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "done" }],
      },
    ]);

    const model = new Model("test-model", provider);
    const grepTool = defineTool({
      name: "grep_search",
      description: "test grep",
      parameters: z.object({ pattern: z.string() }),
      invoke: async () => ({
        ok: false as const,
        summary: "Failed to run rg",
        error: "Failed to run rg",
        code: "RG_NOT_FOUND",
      }),
    });

    const agent = new Agent({
      model,
      prompt: "You are a coding agent.",
      messages: [],
      tools: [grepTool],
      maxSteps: 5,
    });

    for await (const _ of agent.stream({ role: "user", content: [{ type: "text", text: "find foo" }] })) {
      void _;
    }

    expect(provider.calls).toHaveLength(3);

    const firstPromptText = getSystemPromptText(provider.calls[0]!);
    const secondPromptText = getSystemPromptText(provider.calls[1]!);
    const thirdPromptText = getSystemPromptText(provider.calls[2]!);

    expect(firstPromptText).toBe("You are a coding agent.");

    expect(secondPromptText).toContain("You are a coding agent.");
    expect(secondPromptText).toContain("<tool_observation>");
    expect(secondPromptText).toContain("tool=grep_search");
    expect(secondPromptText).toContain("repeated_failures=0");
    expect(secondPromptText).not.toContain("repeated_failure=true");
    expect(secondPromptText).toContain("avoid_immediate_retry_tools=grep_search");

    expect(thirdPromptText).toContain("You are a coding agent.");
    expect(thirdPromptText).toContain("<tool_observation>");
    expect(thirdPromptText).toContain("tool=grep_search");
    expect(thirdPromptText).toContain("repeated_failures=1");
    expect(thirdPromptText).toContain("repeated_failure=true");
    expect(thirdPromptText).toContain("avoid_immediate_retry_tools=grep_search");
  });

  test("does not inject tool observation before any tool failure occurs", async () => {
    const provider = new RecordingProvider([
      {
        role: "assistant",
        content: [{ type: "text", text: "done" }],
      },
    ]);

    const model = new Model("test-model", provider);
    const agent = new Agent({
      model,
      prompt: "You are a coding agent.",
      messages: [],
      tools: [],
      maxSteps: 2,
    });

    for await (const _ of agent.stream({ role: "user", content: [{ type: "text", text: "hello" }] })) {
      void _;
    }

    expect(provider.calls).toHaveLength(1);
    expect(getSystemPromptText(provider.calls[0]!)).toBe("You are a coding agent.");
  });
});
