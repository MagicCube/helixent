import { describe, expect, test } from "bun:test";

import { StreamAccumulator } from "../stream-utils";

describe("StreamAccumulator (Anthropic)", () => {
  test("accumulates text from content_block_start and delta", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "Hello" },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: " world" },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({ type: "text", text: "Hello world" });
    expect(snapshot.streaming).toBe(true);
  });

  test("accumulates thinking content", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking", thinking: "Let me " },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "thinking_delta", thinking: "think..." },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    const thinking = snapshot.content[0] as unknown as { type: string; thinking: string; _anthropicSignature?: string };
    expect(thinking.type).toBe("thinking");
    expect(thinking.thinking).toBe("Let me think...");
  });

  test("preserves thinking signature", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking", thinking: "hmm", signature: "sig_abc" },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "signature_delta", signature: "sig_updated" },
    } as never);

    const snapshot = acc.snapshot();
    const thinking = snapshot.content[0] as unknown as { type: string; thinking: string; _anthropicSignature?: string };
    expect(thinking._anthropicSignature).toBe("sig_updated");
  });

  test("accumulates tool_use input JSON progressively", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "tu_1", name: "bash" },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '{"command"' },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: ':"ls"}' },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({
      type: "tool_use",
      id: "tu_1",
      name: "bash",
      input: { command: "ls" },
    });
  });

  test("returns empty input for incomplete tool_use JSON", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "tu_1", name: "bash" },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '{"command"' },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(1);
    expect(snapshot.content[0]).toMatchObject({
      type: "tool_use",
      id: "tu_1",
      name: "bash",
      input: {},
    });
  });

  test("captures usage from message_start and message_delta", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "message_start",
      message: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3",
        usage: { input_tokens: 20, output_tokens: 0 },
      },
    } as never);
    acc.push({
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 10 },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.usage).toEqual({ promptTokens: 20, completionTokens: 10, totalTokens: 30 });
    expect(snapshot.streaming).toBeUndefined();
  });

  test("handles multiple blocks in order", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking", thinking: "hmm" },
    } as never);
    acc.push({
      type: "content_block_start",
      index: 1,
      content_block: { type: "text", text: "Answer" },
    } as never);
    acc.push({
      type: "content_block_start",
      index: 2,
      content_block: { type: "tool_use", id: "tu_1", name: "bash" },
    } as never);
    acc.push({
      type: "content_block_delta",
      index: 2,
      delta: { type: "input_json_delta", partial_json: '{"cmd":"x"}' },
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(3);
    expect(snapshot.content[0]).toMatchObject({ type: "thinking" });
    expect(snapshot.content[1]).toMatchObject({ type: "text", text: "Answer" });
    expect(snapshot.content[2]).toMatchObject({ type: "tool_use", name: "bash" });
  });

  test("ignores unknown event types", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_stop",
      index: 0,
    } as never);
    acc.push({
      type: "message_stop",
    } as never);

    const snapshot = acc.snapshot();
    expect(snapshot.content).toHaveLength(0);
  });

  test("returns empty content for text block with no text", () => {
    const acc = new StreamAccumulator();
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    } as never);

    const snapshot = acc.snapshot();
    // Empty text blocks are filtered out
    expect(snapshot.content).toHaveLength(0);
  });
});
