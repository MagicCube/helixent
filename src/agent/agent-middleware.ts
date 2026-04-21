/* eslint-disable no-unused-vars */

import type { AssistantMessage, ModelContext, ToolUseContent } from "@/foundation";

import type { AgentContext } from "./agent";

/**
 * Middleware hooks that let you observe and/or mutate an {@link Agent}'s run.
 *
 * Hooks are invoked **sequentially** in middleware array order. Each hook receives the
 * same `context` object used by the agent loop.
 *
 * If a hook returns a truthy `Partial<AgentContext>`, it will be merged into the shared
 * context via `Object.assign(context, result)`. Returning `null`/`undefined`/`void` (or any
 * other falsy value) means "no change".
 *
 * All hooks are optional.
 */
export type BeforeModelParams = {
  /** The model context for this run (shared, mutable). */
  modelContext: ModelContext;
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
};

export type AfterModelParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
  /** The assistant message for this run (shared, mutable). */
  message: AssistantMessage;
};

export type BeforeAgentRunParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
};

export type AfterAgentRunParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
};

export type BeforeAgentStepParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
  /** The current step number (1-based). */
  step: number;
};

export type AfterAgentStepParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
  /** The current step number (1-based). */
  step: number;
};

export type BeforeToolUseParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
  /** The tool call descriptor emitted by the model. */
  toolUse: ToolUseContent;
};

export type AfterToolUseParams = {
  /** The agent context for this run (shared, mutable). */
  agentContext: AgentContext;
  /** The tool call descriptor emitted by the model. */
  toolUse: ToolUseContent;
  /** The raw result returned by the tool implementation. */
  toolResult: unknown;
};

export type BeforeToolUseResult =
  | Partial<AgentContext>
  | { readonly __skip: true; readonly result: unknown }
  | null
  | undefined
  | void;

export interface AgentMiddleware {
  /**
   * Runs immediately before the model is invoked.
   * @param params - Hook parameters.
   * @returns Optional model context updates to merge into `modelContext`.
   */
  beforeModel?: (params: BeforeModelParams) => Promise<Partial<ModelContext> | null | undefined | void>;

  /**
   * Runs immediately after the model is invoked.
   * @param params - Hook parameters.
   * @returns Optional message updates to merge into `message`.
   */
  afterModel?: (params: AfterModelParams) => Promise<Partial<AssistantMessage> | null | undefined | void>;

  /**
   * Runs once after the user message is appended, before the first step begins.
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`.
   */
  beforeAgentRun?: (params: BeforeAgentRunParams) => Promise<Partial<AgentContext> | null | undefined | void>;
  /**
   * Runs once when the agent is about to stop because it produced no tool calls.
   *
   * Note: this hook is **not** called if the agent throws (e.g. max steps reached).
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`.
   */
  afterAgentRun?: (params: AfterAgentRunParams) => Promise<Partial<AgentContext> | null | undefined | void>;

  /**
   * Runs at the start of each step, before the model is invoked.
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`.
   */
  beforeAgentStep?: (params: BeforeAgentStepParams) => Promise<Partial<AgentContext> | null | undefined | void>;
  /**
   * Runs at the end of each step, after all tool uses for the step have completed
   * (if any).
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`.
   */
  afterAgentStep?: (params: AfterAgentStepParams) => Promise<Partial<AgentContext> | null | undefined | void>;

  /**
   * Runs immediately before a tool is invoked.
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`, or a skip instruction to bypass tool execution.
   */
  beforeToolUse?: (params: {
    agentContext: AgentContext;
    toolUse: ToolUseContent<Record<string, unknown>>;
  }) => Promise<BeforeToolUseResult>;
  /**
   * Runs immediately after a tool invocation resolves.
   * @param params - Hook parameters.
   * @returns Optional context updates to merge into `context`.
   */
  afterToolUse?: (params: AfterToolUseParams) => Promise<Partial<AgentContext> | null | undefined | void>;
}
