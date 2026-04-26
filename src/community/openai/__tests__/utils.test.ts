import { describe, expect, test } from "bun:test";

import type { Message } from "@/foundation";

import { convertToOpenAIMessages } from "../utils";

describe("convertToOpenAIMessages", () => {
  test("preserves thinking content as reasoning_content", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "let me reason about this" },
          { type: "text", text: "hi there" },
        ],
      },
      { role: "user", content: [{ type: "text", text: "follow up" }] },
    ];

    const result = convertToOpenAIMessages(messages);
    const assistantMsg = result[1] as unknown as Record<string, unknown>;

    expect(assistantMsg.reasoning_content).toBe("let me reason about this");
    expect(assistantMsg.content).toEqual([{ type: "text", text: "hi there" }]);
  });

  test("handles thinking-only assistant message (no text)", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "think about this" }] },
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "deep thoughts" }],
      },
    ];

    const result = convertToOpenAIMessages(messages);
    const assistantMsg = result[1] as unknown as Record<string, unknown>;

    expect(assistantMsg.reasoning_content).toBe("deep thoughts");
  });

  test("handles assistant message without thinking content", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
      },
    ];

    const result = convertToOpenAIMessages(messages);
    const assistantMsg = result[1] as unknown as Record<string, unknown>;

    expect(assistantMsg.reasoning_content).toBeUndefined();
    expect(assistantMsg.content).toEqual([{ type: "text", text: "hi" }]);
  });
});
