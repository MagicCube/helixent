import { describe, expect, test } from "bun:test";

import { StreamAccumulator } from "../stream-utils";

describe("StreamAccumulator (OpenAI)", () => {
  test("accumulates text content from chunks", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
    });
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [{ index: 0, delta: { content: " world" }, finish_reason: null }],
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({ type: "text", text: "Hello world" });
    expect(snapshot.streaming).toBe(true);
  });

  test("accumulates reasoning_content", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        { index: 0, delta: { reasoning_content: "thinking" } as never, finish_reason: null },
      ],
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({ type: "thinking", thinking: "thinking" });
  });

  test("accumulates tool calls across multiple chunks", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: "" } }] },
          finish_reason: null,
        },
      ],
    });
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: '{"command"' } }] },
          finish_reason: null,
        },
      ],
    });
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: ':"ls"}' } }] },
          finish_reason: null,
        },
      ],
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({
      type: "tool_use",
      id: "call_1",
      name: "bash",
      input: { command: "ls" },
    });
  });

  test("withholds incomplete tool_use during streaming", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: '{"command' } }] },
          finish_reason: null,
        },
      ],
    });

    // Arguments are incomplete JSON — tool_use should be withheld
    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(0);
  });

  test("includes tool_use with empty input on final snapshot even if JSON is incomplete", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: '{"command' } }] },
          finish_reason: null,
        },
      ],
    });
    // Final chunk with usage
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({
      type: "tool_use",
      id: "call_1",
      name: "bash",
      input: {},
    });
    expect(snapshot.streaming).toBeUndefined();
  });

  test("captures usage from final chunk", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }],
    });
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    });

    const snapshot = acc.snapshot();
    expect(snapshot.usage).toEqual({ promptTokens: 10, completionTokens: 2, totalTokens: 12 });
    expect(snapshot.streaming).toBeUndefined();
  });

  test("handles multiple tool calls in order", () => {
    const acc = new StreamAccumulator();
    // First tool call
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "bash", arguments: '{"cmd":"a"}' } }] },
          finish_reason: null,
        },
      ],
    });
    // Second tool call
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 1, id: "call_2", function: { name: "read_file", arguments: '{"path":"b"}' } }] },
          finish_reason: null,
        },
      ],
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(2);
    expect(snapshot.content[0]).toMatchObject({ type: "tool_use", id: "call_1", name: "bash" });
    expect(snapshot.content[1]).toMatchObject({ type: "tool_use", id: "call_2", name: "read_file" });
  });

  test("handles empty chunk gracefully", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4",
      choices: [],
    });

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(0);
  });
});
