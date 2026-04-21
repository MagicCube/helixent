import { describe, expect, test } from "bun:test";
import { z } from "zod";

import type { AssistantMessage } from "@/foundation";
import { Model } from "@/foundation/models/model";
import type { ModelProvider, ModelProviderInvokeParams } from "@/foundation/models/model-provider";

import { Agent } from "../agent";
import type { AgentProgressThinkingEvent } from "../agent-event";

function createTextStreamingProvider(): ModelProvider {
  const finalMessage: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text: "Hello, world!" }],
  };

  return {
    // eslint-disable-next-line no-unused-vars
    invoke: async (_params: ModelProviderInvokeParams) => finalMessage,
    // eslint-disable-next-line no-unused-vars
    async *stream(_params: ModelProviderInvokeParams) {
      const snapshots: AssistantMessage[] = [
        {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          streaming: true,
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Hello, world" }],
          streaming: true,
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Hello, world!" }],
        },
      ];
      for (const snapshot of snapshots) {
        yield snapshot;
      }
    },
  };
}

function createToolStreamingProvider(): ModelProvider {
  let callCount = 0;

  const toolMessage: AssistantMessage = {
    role: "assistant",
    content: [
      { type: "text", text: "Let me help" },
      {
        type: "tool_use",
        id: "t1",
        name: "bash",
        input: { command: "ls" },
      },
    ],
  };

  const doneMessage: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text: "Done." }],
  };

  return {
    // eslint-disable-next-line no-unused-vars
    invoke: async (_params: ModelProviderInvokeParams) => toolMessage,
    // eslint-disable-next-line no-unused-vars
    async *stream(_params: ModelProviderInvokeParams) {
      callCount++;
      if (callCount === 1) {
        yield {
          role: "assistant" as const,
          content: [
            { type: "text" as const, text: "Let me help" },
            {
              type: "tool_use" as const,
              id: "t1",
              name: "bash",
              input: { command: "ls" },
            },
          ],
          streaming: true,
        };
        yield toolMessage;
      } else {
        yield doneMessage;
      }
    },
  };
}

describe("Agent streaming progress events", () => {
  test("yields thinking progress events with text and delta", async () => {
    const provider = createTextStreamingProvider();
    const model = new Model("test-model", provider);
    const agent = new Agent({ model, prompt: "You are a test assistant.", tools: [] });

    const events: AgentProgressThinkingEvent[] = [];
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      if (event.type === "progress" && event.subtype === "thinking") {
        events.push(event);
      }
    }

    expect(events.length).toBe(2);

    expect(events[0]).toMatchObject({
      type: "progress",
      subtype: "thinking",
      text: "Hello",
      delta: "Hello",
    });

    expect(events[1]).toMatchObject({
      type: "progress",
      subtype: "thinking",
      text: "Hello, world",
      delta: ", world",
    });
  });

  test("emits final message event with complete content", async () => {
    const provider = createTextStreamingProvider();
    const model = new Model("test-model", provider);
    const agent = new Agent({ model, prompt: "You are a test assistant.", tools: [] });

    let finalMessage: AssistantMessage | null = null;
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      if (event.type === "message" && event.message.role === "assistant") {
        finalMessage = event.message as AssistantMessage;
      }
    }

    expect(finalMessage).toBeDefined();
    expect(finalMessage!.role).toBe("assistant");

    const textBlock = finalMessage!.content.find(
      (block) => block.type === "text",
    );
    expect(textBlock).toBeDefined();
    expect((textBlock as { text: string }).text).toBe("Hello, world!");
  });

  test("yields tool progress events without text fields", async () => {
    const provider = createToolStreamingProvider();
    const model = new Model("test-model", provider);

    const bashTool = {
      name: "bash",
      description: "Run bash",
      parameters: z.object({ command: z.string() }),
      invoke: async () => "done",
    };

    const agent = new Agent({ model, prompt: "You are a test assistant.", tools: [bashTool] });

    const toolProgressEvents: { name?: string; text?: string; delta?: string }[] = [];
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      if (event.type === "progress" && event.subtype === "tool") {
        toolProgressEvents.push(event as unknown as { name?: string; text?: string; delta?: string });
      }
    }

    expect(toolProgressEvents.length).toBeGreaterThanOrEqual(1);

    for (const toolEvent of toolProgressEvents) {
      expect(toolEvent.name).toBe("bash");
      expect(toolEvent).not.toHaveProperty("text");
      expect(toolEvent).not.toHaveProperty("delta");
    }
  });
});
