import type Anthropic from "@anthropic-ai/sdk";

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
// Anthropic SDK Content Part Helpers
// ============================================================================

function anthropicTextBlock(text: string): Anthropic.TextBlockParam {
  return { type: "text", text };
}

function anthropicImageBlock(url: string): Anthropic.ImageBlockParam {
  return { type: "image", source: { type: "url", url } };
}

function anthropicThinkingBlock(thinking: string, signature?: string): Anthropic.ThinkingBlockParam {
  return { type: "thinking", thinking, signature: signature ?? "" };
}

function anthropicToolUseBlock(id: string, name: string, input: Record<string, unknown>): Anthropic.ToolUseBlockParam {
  return { type: "tool_use", id, name, input };
}

function anthropicToolResultBlock(toolUseId: string, content: string): Anthropic.ToolResultBlockParam {
  return { type: "tool_result", tool_use_id: toolUseId, content };
}

function anthropicUserMessage(content: Anthropic.ContentBlockParam[]): Anthropic.MessageParam {
  return { role: "user", content };
}

function anthropicAssistantMessage(content: Anthropic.ContentBlockParam[]): Anthropic.MessageParam {
  return { role: "assistant", content };
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Extracts the system prompt from helixent messages.
 * Anthropic takes the system prompt as a separate top-level parameter
 * rather than embedding it in the messages array.
 *
 * @param messages - The helixent messages to extract the system prompt from.
 * @returns The system prompt string, or undefined if none is present.
 */
export function extractSystemPrompt(messages: Message[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === "system");
  if (systemMessages.length === 0) return undefined;
  return systemMessages
    .flatMap((m) => m.content)
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n\n");
}

/**
 * Converts helixent messages to Anthropic MessageParam messages.
 * System messages are excluded here (handled separately via extractSystemPrompt).
 *
 * @param messages - The helixent messages to convert.
 * @returns The Anthropic MessageParam messages.
 */
export function convertToAnthropicMessages(
  messages: Message[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      // System messages are passed separately in Anthropic's API.
      continue;
    }

    if (message.role === "user") {
      const content: Anthropic.ContentBlockParam[] = [];
      for (const part of message.content) {
        if (part.type === "text") {
          content.push(anthropicTextBlock(part.text));
        } else if (part.type === "image_url") {
          content.push(anthropicImageBlock(part.image_url.url));
        }
      }
      result.push(anthropicUserMessage(content));
    } else if (message.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      for (const part of message.content) {
        if (part.type === "text") {
          content.push(anthropicTextBlock(part.text));
        } else if (part.type === "thinking") {
          const signature = part.providerData?._anthropicSignature as string | undefined;
          content.push(anthropicThinkingBlock(part.thinking, signature));
        } else if (part.type === "tool_use") {
          content.push(anthropicToolUseBlock(part.id, part.name, part.input));
        }
      }
      result.push(anthropicAssistantMessage(content));
    } else if (message.role === "tool") {
      const content: Anthropic.ToolResultBlockParam[] = [];
      for (const part of message.content) {
        if (part.type === "tool_result") {
          content.push(anthropicToolResultBlock(part.tool_use_id, part.content));
        }
      }
      result.push(anthropicUserMessage(content));
    }
  }

  return result;
}

/**
 * Parses an Anthropic API response into a helixent AssistantMessage.
 *
 * @param response - The Anthropic API response.
 * @returns The parsed helixent AssistantMessage.
 */
export function parseAssistantMessage(
  response: Anthropic.Message,
  usage?: TokenUsage,
): AssistantMessage {
  const content: AssistantMessageContent = [];

  for (const block of response.content) {
    if (block.type === "text") {
      content.push(createTextContent(block.text));
    } else if (block.type === "thinking") {
      content.push(
        createThinkingContent(
          block.thinking,
          block.signature ? { _anthropicSignature: block.signature } : undefined,
        ),
      );
    } else if (block.type === "tool_use") {
      content.push(createToolUseContent(block.id, block.name, block.input as Record<string, unknown>));
    }
  }

  return createAssistantMessageWithContent(content, { usage });
}

/**
 * Converts helixent tools to Anthropic tool definitions.
 *
 * @param tools - The helixent tools to convert.
 * @returns The Anthropic tool definitions.
 */
export function convertToAnthropicTools(tools: Tool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters.toJSONSchema() as Anthropic.Tool["input_schema"],
  }));
}
