import { describe, expect, test } from "bun:test";

import { convertToOpenAIMessages, parseAssistantMessage, convertToOpenAITools } from "../utils";
import type { Message } from "@/foundation";

describe("convertToOpenAIMessages", () => {
  test("passes system messages through unchanged", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "You are helpful." }] },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "system", content: [{ type: "text", text: "You are helpful." }] });
  });

  test("passes user messages through unchanged", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "user", content: [{ type: "text", text: "Hello" }] });
  });

  test("converts assistant message with text content", () => {
    const messages: Message[] = [
      { role: "assistant", content: [{ type: "text", text: "Hi there" }] },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "assistant", content: "Hi there" });
  });

  test("converts assistant message with tool_use content", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "call_1", name: "bash", input: { command: "ls" } },
        ],
      },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          type: "function",
          id: "call_1",
          function: { name: "bash", arguments: '{"command":"ls"}' },
        },
      ],
    });
  });

  test("skips thinking content in assistant messages", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think..." },
          { type: "text", text: "The answer is 42." },
        ],
      },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "assistant", content: "The answer is 42." });
  });

  test("converts tool messages into separate tool role messages", () => {
    const messages: Message[] = [
      {
        role: "tool",
        content: [
          { type: "tool_result", tool_use_id: "call_1", content: "output" },
          { type: "tool_result", tool_use_id: "call_2", content: "output2" },
        ],
      },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ role: "tool", tool_call_id: "call_1", content: "output" });
    expect(result[1]).toMatchObject({ role: "tool", tool_call_id: "call_2", content: "output2" });
  });

  test("handles mixed assistant content (text + tool_use)", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll run that." },
          { type: "tool_use", id: "call_1", name: "bash", input: { command: "echo hi" } },
        ],
      },
    ];
    const result = convertToOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      tool_calls: [{ type: "function", id: "call_1" }],
    });
    expect((result[0] as { content: unknown[] }).content).toContainEqual({ type: "text", text: "I'll run that." });
  });
});

describe("parseAssistantMessage", () => {
  test("parses text content", () => {
    const result = parseAssistantMessage({
      role: "assistant",
      content: "Hello!",
    });
    expect(result).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
    });
  });

  test("parses reasoning_content as thinking", () => {
    const result = parseAssistantMessage({
      role: "assistant",
      content: "The answer",
      reasoning_content: "Let me reason...",
    });
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toMatchObject({ type: "thinking", thinking: "Let me reason..." });
    expect(result.content[1]).toMatchObject({ type: "text", text: "The answer" });
  });

  test("parses tool_calls", () => {
    const result = parseAssistantMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          type: "function",
          id: "call_1",
          function: { name: "bash", arguments: '{"command":"ls"}' },
        },
      ],
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: "tool_use",
      id: "call_1",
      name: "bash",
      input: { command: "ls" },
    });
  });

  test("includes usage when provided", () => {
    const result = parseAssistantMessage(
      { role: "assistant", content: "Hi" },
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    );
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  test("handles empty content string", () => {
    const result = parseAssistantMessage({
      role: "assistant",
      content: "",
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: "text", text: "" });
  });
});

describe("convertToOpenAITools", () => {
  test("converts tools to OpenAI format", () => {
    const tools = [
      {
        name: "bash",
        description: "Run a command",
        parameters: {
          toJSONSchema: () => ({
            type: "object",
            properties: { command: { type: "string" } },
            required: ["command"],
          }),
        },
      },
    ];
    const result = convertToOpenAITools(tools as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "function",
      function: {
        name: "bash",
        description: "Run a command",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    });
  });

  test("returns empty array for no tools", () => {
    expect(convertToOpenAITools([] as never)).toEqual([]);
  });
});
