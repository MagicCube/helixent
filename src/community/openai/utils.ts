import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";

import {
  createAssistantMessageWithContent,
  createTextContent,
  createThinkingContent,
  createToolUseContent,
  type AssistantMessage,
  type AssistantMessageContent,
  type Message,
  type TokenUsage,
  type Tool,
} from "@/foundation";

// ============================================================================
// OpenAI SDK Content Part Helpers
// ============================================================================

function openaiToolCall(id: string, name: string, argumentsJson: string) {
  return { type: "function" as const, id, function: { name, arguments: argumentsJson } };
}

function openaiAssistantMessage(): ChatCompletionAssistantMessageParam {
  return { role: "assistant", content: [] };
}

function openaiToolMessage(toolCallId: string, content: string): Extract<ChatCompletionMessageParam, { role: "tool" }> {
  return { role: "tool" as const, tool_call_id: toolCallId, content };
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Converts the messages to OpenAI ChatCompletionMessageParam messages.
 * @param messages - The messages to convert.
 * @returns The OpenAI ChatCompletionMessageParam messages.
 */
export function convertToOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
  const openaiMessages: ChatCompletionMessageParam[] = [];
  for (const message of messages) {
    if (message.role === "system" || message.role === "user") {
      openaiMessages.push(message);
    } else if (message.role === "assistant") {
      const assistantMessage = openaiAssistantMessage();
      for (const content of message.content) {
        if (content.type === "thinking") {
          continue;
        } else if (content.type === "tool_use") {
          if (!assistantMessage.tool_calls) {
            assistantMessage.tool_calls = [];
          }
          assistantMessage.tool_calls.push(openaiToolCall(content.id, content.name, JSON.stringify(content.input)));
        } else {
          (assistantMessage.content as ChatCompletionContentPart[]).push(content);
        }
      }
      if (assistantMessage.content?.length === 0) {
        assistantMessage.content = "";
      }
      openaiMessages.push(assistantMessage);
    } else if (message.role === "tool") {
      for (const content of message.content) {
        if (content.type === "tool_result") {
          openaiMessages.push(openaiToolMessage(content.tool_use_id, content.content));
        }
      }
    }
  }
  return openaiMessages;
}

/**
 * Parses the assistant message from the OpenAI ChatCompletionMessage.
 * @param message - The message to parse.
 * @returns The parsed assistant message.
 */
export function parseAssistantMessage(
  message: ChatCompletionMessage & { reasoning_content?: string },
  usage?: TokenUsage,
): AssistantMessage {
  const content: AssistantMessageContent = [];
  if (typeof message.reasoning_content === "string") {
    content.push(createThinkingContent(message.reasoning_content));
  }
  if (typeof message.content === "string") {
    content.push(createTextContent(message.content));
  }
  if (message.tool_calls) {
    for (const tool_call of message.tool_calls) {
      if (tool_call.type === "function") {
        content.push(createToolUseContent(tool_call.id, tool_call.function.name, JSON.parse(tool_call.function.arguments)));
      }
    }
  }
  return createAssistantMessageWithContent(content, { usage });
}

/**
 * Converts the tools to OpenAI ChatCompletionTool messages.
 * @param tools - The tools to convert.
 * @returns The OpenAI ChatCompletionTool messages.
 */
export function convertToOpenAITools(tools: Tool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters.toJSONSchema() },
  }));
}
