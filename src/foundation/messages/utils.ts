import type {
  AssistantMessage,
  AssistantMessageContent,
  ImageURLContent,
  SystemMessage,
  SystemMessageContent,
  TextContent,
  ThinkingContent,
  TokenUsage,
  ToolMessage,
  ToolMessageContent,
  ToolResultContent,
  ToolUseContent,
  UserMessage,
  UserMessageContent,
} from "./types";

// ============================================================================
// Content Part Creators
// ============================================================================

/**
 * Creates a text content part.
 * @param text - The text content.
 * @returns A TextContent object.
 */
export function createTextContent(text: string): TextContent {
  return { type: "text", text };
}

/**
 * Creates an image URL content part.
 * @param url - The image URL.
 * @param detail - Optional detail level for vision models.
 * @returns An ImageURLContent object.
 */
export function createImageURLContent(
  url: string,
  detail?: "auto" | "high" | "low",
): ImageURLContent {
  return {
    type: "image_url",
    image_url: {
      url: url as "https://example.com",
      ...(detail && { detail }),
    } as ImageURLContent["image_url"],
  };
}

/**
 * Creates a thinking content part (for models that expose reasoning).
 * @param thinking - The reasoning text.
 * @param providerData - Optional provider-specific metadata.
 * @returns A ThinkingContent object.
 */
export function createThinkingContent(thinking: string, providerData?: Record<string, unknown>): ThinkingContent {
  return { type: "thinking", thinking, ...(providerData && { providerData }) };
}

/**
 * Creates a tool use content part.
 * @param id - The unique tool call ID.
 * @param name - The tool name.
 * @param input - The tool arguments.
 * @returns A ToolUseContent object.
 */
export function createToolUseContent<T extends Record<string, unknown> = Record<string, unknown>>(
  id: string,
  name: string,
  input: T,
): ToolUseContent<T> {
  return { type: "tool_use", id, name, input };
}

/**
 * Creates a tool result content part.
 * @param toolUseId - The ID of the corresponding tool_use.
 * @param content - The result content (often JSON string).
 * @returns A ToolResultContent object.
 */
export function createToolResultContent(toolUseId: string, content: string): ToolResultContent {
  return { type: "tool_result", tool_use_id: toolUseId, content };
}

// ============================================================================
// Message Creators
// ============================================================================

/**
 * Creates a system message with the given text.
 * @param text - The system prompt text.
 * @returns A SystemMessage object.
 */
export function createSystemMessage(text: string): SystemMessage {
  return { role: "system", content: [createTextContent(text)] };
}

/**
 * Creates a system message with multiple content parts.
 * @param content - Array of content parts (only text allowed for system messages).
 * @returns A SystemMessage object.
 */
export function createSystemMessageWithContent(content: SystemMessageContent): SystemMessage {
  return { role: "system", content };
}

/**
 * Creates a user message with the given text.
 * @param text - The user message text.
 * @returns A UserMessage object.
 */
export function createUserMessage(text: string): UserMessage {
  return { role: "user", content: [createTextContent(text)] };
}

/**
 * Creates a user message with multiple content parts (text and/or images).
 * @param content - Array of TextContent or ImageURLContent.
 * @returns A UserMessage object.
 */
export function createUserMessageWithContent(content: UserMessageContent): UserMessage {
  return { role: "user", content };
}

/**
 * Creates a user message with text and an image URL.
 * @param text - The accompanying text.
 * @param imageUrl - The image URL.
 * @param detail - Optional vision detail level.
 * @returns A UserMessage object.
 */
export function createUserMessageWithImage(
  text: string,
  imageUrl: string,
  detail?: "auto" | "high" | "low",
): UserMessage {
  return {
    role: "user",
    content: [createTextContent(text), createImageURLContent(imageUrl, detail)],
  };
}

/**
 * Creates an assistant message with the given text.
 * @param text - The assistant's response text.
 * @returns An AssistantMessage object.
 */
export function createAssistantMessage(text: string): AssistantMessage {
  return { role: "assistant", content: [createTextContent(text)] };
}

/**
 * Creates an assistant message with multiple content parts.
 * @param content - Array of TextContent, ThinkingContent, and/or ToolUseContent.
 * @param options - Optional fields (usage, streaming).
 * @returns An AssistantMessage object.
 */
export function createAssistantMessageWithContent(
  content: AssistantMessageContent,
  options?: { usage?: TokenUsage; streaming?: boolean },
): AssistantMessage {
  return {
    role: "assistant",
    content,
    ...(options?.usage && { usage: options.usage }),
    ...(options?.streaming && { streaming: true }),
  };
}

/**
 * Creates an assistant message with text and thinking content.
 * @param text - The response text.
 * @param thinking - The model's reasoning/thinking.
 * @returns An AssistantMessage object.
 */
export function createAssistantMessageWithThinking(text: string, thinking: string): AssistantMessage {
  return {
    role: "assistant",
    content: [createTextContent(text), createThinkingContent(thinking)],
  };
}

/**
 * Creates a tool message (tool execution result).
 * @param toolUseId - The ID of the corresponding tool_use.
 * @param content - The result content.
 * @returns A ToolMessage object.
 */
export function createToolMessage(toolUseId: string, content: string): ToolMessage {
  return {
    role: "tool",
    content: [createToolResultContent(toolUseId, content)],
  };
}

/**
 * Creates a tool message with multiple results.
 * @param content - Array of ToolResultContent.
 * @returns A ToolMessage object.
 */
export function createToolMessageWithContent(content: ToolMessageContent): ToolMessage {
  return { role: "tool", content };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts all text content from a message, concatenated into a single string.
 * For assistant messages, includes both text and thinking content.
 * @param message - The message to extract text from.
 * @returns The concatenated text content.
 */
export function extractTextFromMessage(message: { content: Array<{ type: string; text?: string; thinking?: string }> }): string {
  return message.content
    .map((c) => {
      if (c.type === "text") return c.text ?? "";
      if (c.type === "thinking") return c.thinking ?? "";
      return "";
    })
    .join("");
}

/**
 * Checks if a message contains any tool_use content.
 * @param message - The message to check (typically an assistant message).
 * @returns True if the message contains tool_use content.
 */
export function hasToolUse(message: { content: Array<{ type: string }> }): boolean {
  return message.content.some((c) => c.type === "tool_use");
}

/**
 * Extracts all tool_use content from a message.
 * @param message - The message to extract from (typically an assistant message).
 * @returns Array of ToolUseContent objects.
 */
export function extractToolUseContent<T extends Record<string, unknown> = Record<string, unknown>>(
  message: { content: Array<{ type: string }> },
): ToolUseContent<T>[] {
  return message.content.filter((c): c is ToolUseContent<T> => c.type === "tool_use");
}
