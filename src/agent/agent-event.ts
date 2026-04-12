import type { AssistantMessage, ToolMessage } from "@/foundation";

/** Discriminator values for {@link AgentEvent.type}. */
export type AgentEventType = "message" | "progress";

/** Discriminator values for {@link AgentProgressEvent.subtype}. */
export type AgentProgressSubtype = "thinking" | "tool";

/**
 * Fired once per completed assistant turn and once per completed tool result.
 * `message.streaming` is always absent/false on events of this type.
 */
export interface AgentMessageEvent {
  type: "message";
  message: AssistantMessage | ToolMessage;
}

/**
 * Fired while the current model snapshot has only text and/or thinking
 * content — i.e. no `tool_use` entries yet.
 *
 * When the model is producing text tokens, `text` carries the accumulated
 * output so far and `delta` carries the incremental fragment added since the
 * previous event.
 */
export interface AgentProgressThinkingEvent {
  type: "progress";
  subtype: "thinking";
  /** Accumulated text output so far (empty string until the first text token). */
  text: string;
  /** Incremental text fragment added since the previous progress event. */
  delta: string;
}

/**
 * Fired while the current model snapshot contains at least one `tool_use`.
 * The payload reflects the **last** `tool_use` in the snapshot; its `input`
 * may be a partial / in-progress JSON value.
 */
export interface AgentProgressToolEvent {
  type: "progress";
  subtype: "tool";
  /** Name of the most recent tool_use in the current snapshot. */
  name: string;
  /** Current (possibly partial) input payload of that tool_use. */
  input: unknown;
}

/** Union of all progress events; narrow on `subtype`. */
export type AgentProgressEvent = AgentProgressThinkingEvent | AgentProgressToolEvent;

/** Union of all agent events; narrow on `type`, then on `subtype`. */
export type AgentEvent = AgentMessageEvent | AgentProgressEvent;
