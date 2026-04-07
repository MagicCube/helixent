import type {
  AssistantMessage,
  Model,
  ModelContext,
  NonSystemMessage,
  Tool,
  ToolMessage,
  ToolUseContent,
  UserMessage,
} from "@/foundation";

import type { AgentMiddleware } from "./agent-middleware";
import type { SkillFrontmatter } from "./skills/types";

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

  /**
   * Runs the agent.
   * @param message - The message to send to the agent.
   * @returns The response from the agent. If the agent ran successfully, the response will be the final response from the agent. If the agent stopped running due to a maximum number of steps being reached, the response will be the last response from the agent.
   */
  async *stream(message: UserMessage): AsyncGenerator<AssistantMessage | ToolMessage> {
    this._appendMessage(message);
    await this._beforeAgentRun();
    for (let step = 1; step <= this.options.maxSteps; step++) {
      await this._beforeAgentStep(step);
      const assistantMessage = await this._think();
      await this._afterModel(assistantMessage);
      yield assistantMessage;

      const toolUses = this._extractToolUses(assistantMessage);
      if (toolUses.length === 0) {
        await this._afterAgentRun();
        return;
      }

      yield* this._act(toolUses);
      await this._afterAgentStep(step);
    }
    throw new Error("Maximum number of steps reached");
  }

  private async _think(): Promise<AssistantMessage> {
    const modelContext: ModelContext = {
      prompt: this.prompt,
      messages: this.messages,
      tools: this.tools,
    };
    await this._beforeModel(modelContext);
    const message = await this.model.invoke(modelContext);
    this._appendMessage(message);
    return message;
  }

  private _extractToolUses(message: AssistantMessage): ToolUseContent[] {
    return message.content.filter((content): content is ToolUseContent => content.type === "tool_use");
  }

  private async *_act(toolUses: ToolUseContent[]): AsyncGenerator<ToolMessage> {
    const pending = toolUses.map(async (toolUse, index) => {
      const tool = this.tools?.find((t) => t.name === toolUse.name);
      if (!tool) throw new Error(`Tool ${toolUse.name} not found`);
      await this._beforeToolUse(toolUse);
      const result = await tool.invoke(toolUse.input);
      await this._afterToolUse(toolUse, result);
      return { index, toolUseId: toolUse.id, result };
    });

    const remaining = new Set(pending.map((_, i) => i));
    while (remaining.size > 0) {
      const resolved = (await Promise.race([...remaining].map((i) => pending[i])))!;
      remaining.delete(resolved.index);

      const toolMessage: ToolMessage = {
        role: "tool",
        content: [
          {
            type: "tool_result",
            tool_use_id: resolved.toolUseId,
            content: stringifyToolResult(resolved.result),
          },
        ],
      };
      this._appendMessage(toolMessage);
      yield toolMessage;
    }
  }

  private _appendMessage(message: NonSystemMessage) {
    this.messages.push(message);
  }

  private async _beforeModel(modelContext: ModelContext) {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeModel) continue;
      const result = await middleware.beforeModel(modelContext, this._context);
      if (result) {
        Object.assign(modelContext, result);
      }
    }
  }

  private async _afterModel(message: AssistantMessage) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterModel) continue;
      const result = await middleware.afterModel(this._context, message);
      if (result) {
        Object.assign(message, result);
      }
    }
  }

  private async _beforeAgentRun() {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeAgentRun) continue;
      const result = await middleware.beforeAgentRun(this._context);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _afterAgentRun() {
    for (const middleware of this.middlewares) {
      if (!middleware.afterAgentRun) continue;
      const result = await middleware.afterAgentRun(this._context);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _beforeAgentStep(step: number) {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeAgentStep) continue;
      const result = await middleware.beforeAgentStep(this._context, step);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _afterAgentStep(step: number) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterAgentStep) continue;
      const result = await middleware.afterAgentStep(this._context, step);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _beforeToolUse(toolUse: ToolUseContent) {
    for (const middleware of this.middlewares) {
      if (!middleware.beforeToolUse) continue;
      const result = await middleware.beforeToolUse(this._context, toolUse);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }

  private async _afterToolUse(toolUse: ToolUseContent, toolResult: unknown) {
    for (const middleware of this.middlewares) {
      if (!middleware.afterToolUse) continue;
      const result = await middleware.afterToolUse(this._context, toolUse, toolResult);
      if (result) {
        Object.assign(this._context, result);
      }
    }
  }
}

function stringifyToolResult(result: unknown): string {
  if (result === undefined) return "undefined";
  if (result === null) return "null";
  if (typeof result === "object") return JSON.stringify(result);
  return String(result);
}
