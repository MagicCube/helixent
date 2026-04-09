import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";

import type { AssistantMessage, Message, Tool } from "@/foundation";

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
      const assistantMessage: ChatCompletionAssistantMessageParam & { reasoning_content?: string } = {
        role: "assistant",
        content: [],
      };
      for (const content of message.content) {
        if (content.type === "thinking") {
          if (!assistantMessage.reasoning_content) {
            assistantMessage.reasoning_content = content.thinking;
          } else {
            assistantMessage.reasoning_content += "\n" + content.thinking;
          }
        } else if (content.type === "tool_use") {
          if (!assistantMessage.tool_calls) {
            assistantMessage.tool_calls = [];
          }
          assistantMessage.tool_calls.push({
            type: "function",
            id: content.id,
            function: {
              name: content.name,
              arguments: JSON.stringify(content.input),
            },
          });
        } else {
          (assistantMessage.content as ChatCompletionContentPart[]).push(content);
        }
      }
      if (Array.isArray(assistantMessage.content)) {
        assistantMessage.content = assistantMessage.content.filter((part) => {
          if (part.type === "text") {
            return part.text.length > 0;
          }
          return true;
        });

        if (assistantMessage.content.length === 0) {
          assistantMessage.content = "";
        }
      } else if (!assistantMessage.content) {
        assistantMessage.content = "";
      }
      openaiMessages.push(assistantMessage);
    } else if (message.role === "tool") {
      for (const content of message.content) {
        if (content.type === "tool_result") {
          openaiMessages.push({
            role: "tool",
            tool_call_id: content.tool_use_id,
            content: content.content,
          });
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
): AssistantMessage {
  const result: AssistantMessage = {
    role: "assistant",
    content: [],
  };
  if (typeof message.reasoning_content === "string") {
    result.content.push({ type: "thinking", thinking: message.reasoning_content });
  }
  if (typeof message.content === "string") {
    result.content.push({ type: "text", text: message.content });
  }
  if (message.tool_calls) {
    for (const tool_call of message.tool_calls) {
      if (tool_call.type === "function") {
        result.content.push({
          type: "tool_use",
          id: tool_call.id,
          name: tool_call.function.name,
          input: JSON.parse(tool_call.function.arguments),
        });
      }
    }
  }
  return result;
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
