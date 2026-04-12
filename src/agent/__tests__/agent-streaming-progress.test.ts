import { describe, expect, test } from "bun:test";
import { Agent } from "../agent";
import type { AgentProgressThinkingEvent } from "../agent-event";
import { Model } from "@/foundation/models/model";
import type {
  ModelProvider,
  ModelProviderInvokeParams,
} from "@/foundation/models/model-provider";
import type { AssistantMessage } from "@/foundation";
import { z } from "zod";

function createTextStreamingProvider(): ModelProvider {
  const finalMessage: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text: "Hello, world!" }],
  };

  return {
    invoke: async (_params: ModelProviderInvokeParams) => finalMessage,
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
    invoke: async (_params: ModelProviderInvokeParams) => toolMessage,
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
        // Second call: return a text-only message to end the loop
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

    const events: any[] = [];
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      events.push(event);
    }

    const thinkingEvents = events.filter(
      (e) => e.type === "progress" && e.subtype === "thinking",
    ) as AgentProgressThinkingEvent[];

    expect(thinkingEvents.length).toBe(2);

    expect(thinkingEvents[0]).toMatchObject({
      type: "progress",
      subtype: "thinking",
      text: "Hello",
      delta: "Hello",
    });

    expect(thinkingEvents[1]).toMatchObject({
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

    const events: any[] = [];
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      events.push(event);
    }

    const messageEvent = events.find((e) => e.type === "message");
    expect(messageEvent).toBeDefined();
    expect(messageEvent.message.role).toBe("assistant");

    const textBlock = messageEvent.message.content.find(
      (block: any) => block.type === "text",
    );
    expect(textBlock).toBeDefined();
    expect(textBlock.text).toBe("Hello, world!");
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

    const events: any[] = [];
    for await (const event of agent.stream({
      role: "user",
      content: [{ type: "text", text: "Hi" }],
    })) {
      events.push(event);
    }

    const toolProgressEvents = events.filter(
      (e) => e.type === "progress" && e.subtype === "tool",
    );

    expect(toolProgressEvents.length).toBeGreaterThanOrEqual(1);

    for (const toolEvent of toolProgressEvents) {
      expect(toolEvent.name).toBe("bash");
      expect(toolEvent).not.toHaveProperty("text");
      expect(toolEvent).not.toHaveProperty("delta");
    }
  });
});
