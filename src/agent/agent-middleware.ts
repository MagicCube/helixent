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
export interface AgentMiddleware {
  /**
   * Runs immediately before the model is invoked.
   * @param modelContext - The model context for this run (shared, mutable).
   * @param agentContext - The agent context for this run (shared, mutable).
   * @returns Optional model context updates to merge into `modelContext`.
   */
  beforeModel?: (
    modelContext: ModelContext,
    agentContext: AgentContext,
  ) => Promise<Partial<ModelContext> | null | undefined | void>;

  /**
   * Runs immediately after the model is invoked.
   * @param context - The agent context for this run (shared, mutable).
   * @param message - The assistant message for this run (shared, mutable).
   * @returns Optional message updates to merge into `message`.
   */
  afterModel?: (
    context: AgentContext,
    message: AssistantMessage,
  ) => Promise<Partial<AssistantMessage> | null | undefined | void>;

  /**
   * Runs once after the user message is appended, before the first step begins.
   * @param context - The agent context for this run (shared, mutable).
   * @returns Optional context updates to merge into `context`.
   */
  beforeAgentRun?: (context: AgentContext) => Promise<Partial<AgentContext> | null | undefined | void>;
  /**
   * Runs once when the agent is about to stop because it produced no tool calls.
   *
   * Note: this hook is **not** called if the agent throws (e.g. max steps reached).
   * @param context - The agent context for this run (shared, mutable).
   * @returns Optional context updates to merge into `context`.
   */
  afterAgentRun?: (context: AgentContext) => Promise<Partial<AgentContext> | null | undefined | void>;

  /**
   * Runs at the start of each step, before the model is invoked.
   * @param context - The agent context for this run (shared, mutable).
   * @param step - The current step number (1-based).
   * @returns Optional context updates to merge into `context`.
   */
  beforeAgentStep?: (context: AgentContext, step: number) => Promise<Partial<AgentContext> | null | undefined | void>;
  /**
   * Runs at the end of each step, after all tool uses for the step have completed
   * (if any).
   * @param context - The agent context for this run (shared, mutable).
   * @param step - The current step number (1-based).
   * @returns Optional context updates to merge into `context`.
   */
  afterAgentStep?: (context: AgentContext, step: number) => Promise<Partial<AgentContext> | null | undefined | void>;

  /**
   * Runs immediately before a tool is invoked.
   * @param context - The agent context for this run (shared, mutable).
   * @param toolUse - The tool call descriptor emitted by the model.
   * @returns Optional context updates to merge into `context`.
   */
  beforeToolUse?: (
    context: AgentContext,
    toolUse: ToolUseContent,
  ) => Promise<Partial<AgentContext> | null | undefined | void>;
  /**
   * Runs immediately after a tool invocation resolves.
   * @param context - The agent context for this run (shared, mutable).
   * @param toolUse - The tool call descriptor emitted by the model.
   * @param toolResult - The raw result returned by the tool implementation.
   * @returns Optional context updates to merge into `context`.
   */
  afterToolUse?: (
    context: AgentContext,
    toolUse: ToolUseContent,
    toolResult: unknown,
  ) => Promise<Partial<AgentContext> | null | undefined | void>;
}
