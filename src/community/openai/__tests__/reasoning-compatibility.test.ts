import { describe, expect, test } from "bun:test";

import type { Message } from "@/foundation";

import { convertToOpenAIMessages, parseAssistantMessage } from "../utils";

describe("OpenAI reasoning compatibility", () => {
  test("does not emit reasoning_content for empty thinking blocks", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: "answer" },
        ],
      },
    ];

    const [assistant] = convertToOpenAIMessages(messages);
    expect(assistant).toMatchObject({ role: "assistant" });
    expect(Object.prototype.hasOwnProperty.call(assistant, "reasoning_content")).toBe(false);
  });

  test("does not create an internal thinking block from empty reasoning_content", () => {
    const parsed = parseAssistantMessage({
      role: "assistant",
      content: "answer",
      reasoning_content: "",
    } as never);

    expect(parsed.content).toEqual([{ type: "text", text: "answer" }]);
  });
});
