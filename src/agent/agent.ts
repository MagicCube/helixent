import {
  createToolMessage,
  type AssistantMessage,
  type Model,
  type ModelContext,
  type NonSystemMessage,
  type Tool,
  type ToolMessage,
  type ToolUseContent,
  type UserMessage,
} from "@/foundation";

import type { AgentEvent } from "./agent-event";
import type { AgentMiddleware } from "./agent-middleware";
import type { SkillFrontmatter } from "./skills/types";
import { formatToolResultForMessage } from "./tool-result-runtime";

/**
 * A context that is used to invoke a React agent.
 */
export interface AgentContext {
  /** The system prompt to use to invoke the agent. */
  prompt: string;
  /** The messages to use to invoke the agent. */
  messages: NonSystemMessage[];
  /** The tools to use to invoke the agent. */
  tools?: Tool[];
  /** The skills to use to invoke the agent. */
  skills?: SkillFrontmatter[];
  /** Explicitly requested skill for the next run, when set by the caller. */
  requestedSkillName?: string | null;
}

/**
 * The options for the ReactAgent.
 */
export interface AgentOptions {
  /** The maximum number of steps to take. */
  maxSteps?: number;
}

/**
 * An agent loop that uses the ReAct pattern to reason about and execute actions.
 * @param name - The name of the agent.
 * @param model - The model to use to invoke the agent.
 * @param context - The context of the agent.
 * @param options - The options for the agent.
 */
export class Agent {
  private readonly _context: AgentContext;
  private _streaming = false;
  private _abortController: AbortController | null = null;

  readonly name?: string;
  readonly model: Model;
  readonly options: Required<AgentOptions>;
  readonly middlewares: AgentMiddleware[];

  /**
   * Creates a new agent.
   * @param name - The name of the agent.
   * @param model - The model to use to invoke the agent.
   * @param context - The context of the agent.
   * @param options - The options for the agent.
   */
  constructor({
    name,
    model,
    prompt,
    messages = [],
    tools,
    middlewares = [],
    maxSteps = 100,
  }: {
    name?: string;
    model: Model;
    prompt: string;
    messages?: NonSystemMessage[];
    tools?: Tool[];
    middlewares?: AgentMiddleware[];
    maxSteps?: number;
  }) {
    this.name = name;
    this.model = model;
    this._context = {
      prompt,
      tools,
      messages,
    };
    this.middlewares = middlewares;
    this.options = { maxSteps };
  }

  /**
   * Gets the messages for the agent.
   */
  get messages() {
    return this._context.messages;
  }

  /**
   * Gets or sets the prompt for the agent.
   */
  get prompt() {
    return this._context.prompt;
  }
  set prompt(prompt: string) {
    this._context.prompt = prompt;
  }

  /**
   * Gets the tools for the agent.
   */
  get tools() {
    return this._context.tools;
  }

  setRequestedSkillName(requestedSkillName: string | null) {
    this._context.requestedSkillName = requestedSkillName;
  }

  /**
   * Gets whether the agent is streaming.
   */
  get streaming() {
    return this._streaming;
  }

  /**
   * Clears all messages from the agent's internal context.
   */
  clearMessages() {
    this._context.messages.length = 0;
  }

  /**
   * Runs the agent.
   * @param message - The message to send to the agent.
   * @returns The response from the agent. If the agent ran successfully, the response will be the final response from the agent. If the agent stopped running due to a maximum number of steps being reached, the response will be the last response from the agent.
   */
  async *stream(message: UserMessage): AsyncGenerator<AgentEvent> {
    if (this._streaming) {
      throw new Error("Agent is already streaming");
    }

    this._abortController = new AbortController();
    this._appendMessage(message);
    await this._beforeAgentRun();
    this._streaming = true;
    try {
      for (let step = 1; step <= this.options.maxSteps; step++) {
        this._abortController.signal.throwIfAborted();
        await this._beforeAgentStep(step);
        const assistantMessage = yield* this._think();
        await this._afterModel(assistantMessage);
        yield { type: "message", message: assistantMessage };

        const toolUses = this._extractToolUses(assistantMessage);
        if (toolUses.length === 0) {
          await this._afterAgentRun();
          return;
        }

        yield* this._act(toolUses);
        await this._afterAgentStep(step);
      }
      throw new Error("Maximum number of steps reached");
    } finally {
      this._streaming = false;
      this._abortController = null;
    }
  }

  /**
   * Aborts the current stream, including any in-flight model request.
   */
  abort() {
    this._abortController?.abort();
  }

  private async *_think(): AsyncGenerator<AgentEvent, AssistantMessage> {
    const modelContext: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools,
      signal: this._abortController?.signal,
    };
    await this._beforeModel(modelContext);

    let latest: AssistantMessage | null = null;
    for await (const snapshot of this.model.stream(modelContext)) {
      latest = snapshot;
      if (snapshot.streaming) {
        yield this._deriveProgress(snapshot);
      }
    }
    if (!latest) {
      throw new Error("Model stream ended without producing a message");
    }
    // Defensive: ensure the final message is not flagged as streaming.
    if (latest.streaming) {
      delete latest.streaming;
    }
    this._appendMessage(latest);
    return latest;
  }

  private _deriveProgress(snapshot: AssistantMessage): AgentEvent {
    const toolUses = snapshot.content.filter(
      (c): c is ToolUseContent => c.type === "tool_use",
    );
    if (toolUses.length === 0) {
      return { type: "progress", subtype: "thinking" };
    }
    const last = toolUses[toolUses.length - 1]!;
    return { type: "progress", subtype: "tool", name: last.name, input: last.input };
  }

  private _extractToolUses(message: AssistantMessage): ToolUseContent[] {
    return message.content.filter((content): content is ToolUseContent => content.type === "tool_use");
  }

  private async *_act(toolUses: ToolUseContent[]): AsyncGenerator<AgentEvent> {
    const signal = this._abortController?.signal;
    const pending = toolUses.map(async (toolUse, index) => {
      try {
        const tool = this.tools?.find((t) => t.name === toolUse.name);
        if (!tool) throw new Error(`Tool ${toolUse.name} not found`);
        const beforeResult = await this._beforeToolUse(toolUse);
        if (beforeResult.skip) {
          return { index, toolUseId: toolUse.id, toolName: toolUse.name, result: beforeResult.result };
        }
        const result = await tool.invoke(toolUse.input, signal);
        await this._afterToolUse(toolUse, result);
        return { index, toolUseId: toolUse.id, toolName: toolUse.name, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { index, toolUseId: toolUse.id, toolName: toolUse.name, result: `Error: ${message}` };
      }
    });

    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
      : null;

    const remaining = new Set(pending.map((_, i) => i));
    while (remaining.size > 0) {
      const candidates = [...remaining].map((i) => pending[i]);
      const resolved = (await (abortPromise
        ? Promise.race([...candidates, abortPromise])
        : Promise.race(candidates)))!;
      remaining.delete(resolved.index);

      const toolMessage: ToolMessage = createToolMessage(resolved.toolUseId, formatToolResultForMessage({ toolName: resolved.toolName, result: resolved.result }));
      this._appendMessage(toolMessage);
      yield { type: "message", message: toolMessage };
    }
  }

  private _appendMessage(message: NonSystemMessage) {
    this.messages.push(message);
  }

  private async _beforeModel(modelContext: ModelContext) {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeModel) continue;
      const result = await middleware.beforeModel({ modelContext, agentContext: this._context });
      if (result) {
        Object.assign(modelContext, result);
      }
    }
  }

  private async _afterModel(message: AssistantMessage) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterModel) continue;
      const result = await middleware.afterModel({ agentContext: this._context, message });
      if (result) {
        Object.assign(message, result);
      }
    }
  }

  private async _beforeAgentRun() {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeAgentRun) continue;
      const result = await middleware.beforeAgentRun({ agentContext: this._context });
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _afterAgentRun() {
    for (const middleware of this.middlewares) {
      if (!middleware.afterAgentRun) continue;
      const result = await middleware.afterAgentRun({ agentContext: this._context });
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _beforeAgentStep(step: number) {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeAgentStep) continue;
      const result = await middleware.beforeAgentStep({ agentContext: this._context, step });
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _afterAgentStep(step: number) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterAgentStep) continue;
      const result = await middleware.afterAgentStep({ agentContext: this._context, step });
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _beforeToolUse(toolUse: ToolUseContent): Promise<{ skip: boolean; result?: unknown }> {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeToolUse) continue;
      const result = await middleware.beforeToolUse({ agentContext: this._context, toolUse });
      if (result && typeof result === "object" && "__skip" in result) {
        return { skip: true, result: result.result };
      }
      if (result) {
        Object.assign(this._context, result);
      }
    }
    return { skip: false };
  }

  private async _afterToolUse(toolUse: ToolUseContent, toolResult: unknown) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterToolUse) continue;
      const result = await middleware.afterToolUse({ agentContext: this._context, toolUse, toolResult });
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }
}

