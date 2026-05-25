/**
 * Plain text segment in a message.
 */
export interface TextContent {
  /** Discriminator: this segment is plain text. */
  type: "text";
  /** UTF-8 text body. */
  text: string;
}

/**
 * Image referenced by URL, for multimodal user input.
 */
export interface ImageURLContent {
  /** Discriminator: this segment is an image URL. */
  type: "image_url";
  /** Image URL. */
  image_url: {
    /** HTTPS (or other) URL of the image resource. */
    url: string;
    /**
     * Optional vision detail level; provider-specific.
     * - `auto` — let the model decide resolution tradeoffs.
     * - `high` / `low` — bias toward more or less visual detail.
     */
    detail?: "auto" | "high" | "low";
  };
}

/**
 * Model reasoning or chain-of-thought text (when exposed by the provider).
 */
export interface ThinkingContent {
  /** Discriminator: this segment is model reasoning text. */
  type: "thinking";
  /** Opaque reasoning or chain-of-thought string from the model. */
  thinking: string;
  /** Provider-specific metadata (e.g. Anthropic signature for multi-turn). */
  providerData?: Record<string, unknown>;
}

/**
 * Assistant-initiated tool invocation with structured arguments.
 *
 * @typeParam T - Shape of the tool input payload.
 */
export interface ToolUseContent<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Discriminator: this segment is a tool call. */
  type: "tool_use";
  /** Stable identifier for this invocation; used to correlate with {@link ToolResultContent}. */
  id: string;
  /** Registered tool name the model selected. */
  name: string;
  /** JSON-serializable arguments passed to the tool. */
  input: T;
}

/**
 * Result of executing a tool, linked back to a prior {@link ToolUseContent} by id.
 */
export interface ToolResultContent {
  /** Discriminator: this segment is a tool execution result. */
  type: "tool_result";
  /** Matches {@link ToolUseContent.id} of the call this result answers. */
  tool_use_id: string;
  /** Human- or machine-readable outcome (often JSON string) from the tool runtime. */
  content: string;
}

/** Content allowed in a system message. */
export type SystemMessageContent = TextContent[];

/** Content allowed in a user message (text and/or images). */
export type UserMessageContent = (TextContent | ImageURLContent)[];

/** Content allowed in an assistant message. */
export type AssistantMessageContent = (TextContent | ThinkingContent | ToolUseContent)[];

/** Content allowed in a tool role message. */
export type ToolMessageContent = ToolResultContent[];
