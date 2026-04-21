import { describe, expect, test } from "bun:test";

import {
  extractSystemPrompt,
  convertToAnthropicMessages,
  parseAssistantMessage,
  convertToAnthropicTools,
} from "../utils";
import type { Message } from "@/foundation";

describe("extractSystemPrompt", () => {
  test("returns undefined when no system messages exist", () => {
    expect(extractSystemPrompt([])).toBeUndefined();
  });

  test("extracts text from a single system message", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "You are helpful." }] },
    ];
    expect(extractSystemPrompt(messages)).toBe("You are helpful.");
  });

  test("joins multiple system messages with double newline", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "Rule 1" }] },
      { role: "system", content: [{ type: "text", text: "Rule 2" }] },
    ];
    expect(extractSystemPrompt(messages)).toBe("Rule 1\n\nRule 2");
  });

  test("joins multiple text blocks within a system message", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "Part A" }, { type: "text", text: "Part B" }] },
    ];
    expect(extractSystemPrompt(messages)).toBe("Part A\n\nPart B");
  });
});

describe("convertToAnthropicMessages", () => {
  test("excludes system messages", () => {
    const messages: Message[] = [
      { role: "system", content: [{ type: "text", text: "System prompt" }] },
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "user" });
  });

  test("converts user message with text", () => {
    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "user", content: [{ type: "text", text: "Hello" }] });
  });

  test("converts user message with image_url", () => {
    const messages: Message[] = [
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "https://example.com/img.png" } }],
      },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "user",
      content: [{ type: "image", source: { type: "url", url: "https://example.com/img.png" } }],
    });
  });

  test("converts assistant message with text and tool_use", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll check." },
          { type: "tool_use", id: "tu_1", name: "bash", input: { command: "ls" } },
        ],
      },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      content: [
        { type: "text", text: "I'll check." },
        { type: "tool_use", id: "tu_1", name: "bash", input: { command: "ls" } },
      ],
    });
  });

  test("converts assistant message with thinking content", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think..." } as unknown as { type: "text"; text: string },
        ],
      },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      content: [{ type: "thinking", thinking: "Let me think..." }],
    });
  });

  test("converts tool messages as user messages with tool_result", () => {
    const messages: Message[] = [
      {
        role: "tool",
        content: [{ type: "tool_result", tool_use_id: "tu_1", content: "file contents" }],
      },
    ];
    const result = convertToAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_1", content: "file contents" }],
    });
  });
});

describe("parseAssistantMessage (Anthropic)", () => {
  test("parses text blocks", () => {
    const result = parseAssistantMessage({
      id: "msg_1",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: "text", text: "Hello!" });
  });

  test("parses thinking blocks with signature", () => {
    const result = parseAssistantMessage({
      id: "msg_1",
      type: "message",
      role: "assistant",
      content: [{ type: "thinking", thinking: "hmm", signature: "sig_123" }],
      model: "claude-3",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(result.content).toHaveLength(1);
    const thinking = result.content[0] as Record<string, unknown>;
    expect(thinking.type).toBe("thinking");
    expect(thinking.thinking).toBe("hmm");
    expect(thinking._anthropicSignature).toBe("sig_123");
  });

  test("parses tool_use blocks", () => {
    const result = parseAssistantMessage({
      id: "msg_1",
      type: "message",
      role: "assistant",
      content: [{ type: "tool_use", id: "tu_1", name: "bash", input: { command: "ls" } }],
      model: "claude-3",
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: "tool_use",
      id: "tu_1",
      name: "bash",
      input: { command: "ls" },
    });
  });

  test("includes usage when provided", () => {
    const result = parseAssistantMessage(
      {
        id: "msg_1",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3",
        stop_reason: "end_turn",
        usage: { input_tokens: 20, output_tokens: 10 },
      },
      { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
    );
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 10, totalTokens: 30 });
  });
});

describe("convertToAnthropicTools", () => {
  test("converts tools to Anthropic format", () => {
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
    const result = convertToAnthropicTools(tools as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "bash",
      description: "Run a command",
      input_schema: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    });
  });

  test("returns empty array for no tools", () => {
    expect(convertToAnthropicTools([] as never)).toEqual([]);
  });
});
