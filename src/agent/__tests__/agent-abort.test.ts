import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  type AssistantMessage,
  defineTool,
  Model,
  type ModelProvider,
  type ModelProviderInvokeParams,
  type NonSystemMessage,
  type ToolMessage,
} from "@/foundation";

import { Agent } from "../agent";

/**
 * Minimal ModelProvider stub for testing the agent loop. Each call to
 * `stream` yields a scripted AssistantMessage snapshot and then ends.
 */
class ScriptedModelProvider implements ModelProvider {
  private readonly _messages: AssistantMessage[];
  private _call = 0;

  constructor(messages: AssistantMessage[]) {
    this._messages = messages;
  }

  // eslint-disable-next-line no-unused-vars
  async invoke(_params: ModelProviderInvokeParams): Promise<AssistantMessage> {
    const message = this._messages[this._call++];
    if (!message) throw new Error("ScriptedModelProvider ran out of scripted messages");
    return message;
  }

  // eslint-disable-next-line no-unused-vars
  async *stream(_params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    const message = this._messages[this._call++];
    if (!message) throw new Error("ScriptedModelProvider ran out of scripted messages");
    yield message;
  }
}

function assistantWithToolUse(toolUseId: string, toolName: string): AssistantMessage {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "let me run that" },
      { type: "tool_use", id: toolUseId, name: toolName, input: {} },
    ],
  };
}

/** Assert every tool_use id has a matching tool_result tool_use_id later in the transcript. */
function assertTranscriptBalanced(messages: NonSystemMessage[]): void {
  const pendingToolUseIds = new Set<string>();
  for (const message of messages) {
    if (message.role === "assistant") {
      for (const content of message.content) {
        if (content.type === "tool_use") pendingToolUseIds.add(content.id);
      }
    } else if (message.role === "tool") {
      for (const content of message.content) {
        if (content.type === "tool_result") pendingToolUseIds.delete(content.tool_use_id);
      }
    }
  }
  expect([...pendingToolUseIds]).toEqual([]);
}

describe("Agent abort path", () => {
  test("emits synthetic tool_result for every pending tool_use when aborted mid-execution", async () => {
    // Tool that ignores the signal and never resolves — this forces the
    // abortPromise branch inside Agent._act (the exact failing path).
    const slowTool = defineTool({
      name: "slow_tool",
      description: "never resolves on its own",
      parameters: z.object({}),
      invoke: () => new Promise<string>(() => {}),
    });

    const provider = new ScriptedModelProvider([
      assistantWithToolUse("toolu_test_1", "slow_tool"),
    ]);
    const model = new Model("scripted", provider);

    const agent = new Agent({
      model,
      prompt: "test prompt",
      tools: [slowTool],
    });

    const stream = agent.stream({ role: "user", content: [{ type: "text", text: "go" }] });

    // Drain events on a background task. The tool never resolves, so the stream
    // stays blocked inside _act until we abort.
    const drainPromise = (async () => {
      const events = [];
      try {
        for await (const event of stream) events.push(event);
      } catch (error) {
        return { events, error };
      }
      return { events, error: null };
    })();

    // Give the generator a few microtasks to reach the tool execution point.
    await new Promise((r) => setTimeout(r, 10));

    agent.abort();

    const { events, error } = await drainPromise;

    // The abort should propagate out of the stream as an error.
    expect(error).toBeTruthy();

    // The transcript must be balanced: every tool_use has a matching tool_result.
    assertTranscriptBalanced(agent.messages);

    // Specifically: there should be a synthetic tool_result for toolu_test_1
    // with an "aborted" message.
    const toolMessages = agent.messages.filter((m): m is ToolMessage => m.role === "tool");
    expect(toolMessages).toHaveLength(1);
    const result = toolMessages[0]!.content[0]!;
    expect(result.type).toBe("tool_result");
    if (result.type === "tool_result") {
      expect(result.tool_use_id).toBe("toolu_test_1");
      // Content contains the "aborted" hint somewhere in its string form.
      const contentStr = JSON.stringify(result.content);
      expect(contentStr.toLowerCase()).toContain("abort");
    }

    // And the tool_result was also yielded as a message event so UI layers see it.
    const toolEvents = events.filter(
      (e) =>
        e.type === "message" && (e as { message: NonSystemMessage }).message.role === "tool",
    );
    expect(toolEvents).toHaveLength(1);
  });

  test("balanced transcript when tool respects the signal and errors out normally", async () => {
    // When the tool itself throws on abort, the pending promise resolves via the
    // try/catch inside _act (with an "Error:" string) — the abortPromise race
    // path isn't needed. We just make sure this still produces a balanced
    // transcript and the synthetic-tool_result code path does NOT double-up.
    const respectfulTool = defineTool({
      name: "respectful_tool",
      description: "throws on signal",
      parameters: z.object({}),
      invoke: (_input, signal) =>
        new Promise<string>((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted by signal")),
            { once: true },
          );
        }),
    });

    const provider = new ScriptedModelProvider([
      assistantWithToolUse("toolu_test_2", "respectful_tool"),
    ]);
    const agent = new Agent({
      model: new Model("scripted", provider),
      prompt: "test prompt",
      tools: [respectfulTool],
    });

    const stream = agent.stream({ role: "user", content: [{ type: "text", text: "go" }] });
    const drainPromise = (async () => {
      try {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of stream) {
          // drain
        }
      } catch {
        // swallow
      }
    })();

    await new Promise((r) => setTimeout(r, 10));
    agent.abort();
    await drainPromise;

    assertTranscriptBalanced(agent.messages);

    // Exactly one tool_result, not two (no duplicate from the synthetic path).
    const toolResults = agent.messages.flatMap((m) =>
      m.role === "tool"
        ? m.content.filter((c): c is Extract<typeof c, { type: "tool_result" }> => c.type === "tool_result")
        : [],
    );
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]!.tool_use_id).toBe("toolu_test_2");
  });
});

