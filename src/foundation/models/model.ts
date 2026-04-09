import type { Message } from "../messages";

import type { ModelContext } from "./model-context";
import type { ModelProvider } from "./model-provider";

/**
 * Represents a model that can be used to generate text.
 *
 * @param provider - The provider to use to invoke the model.
 * @param name - The name of the model to use.
 * @param options - The options to pass to the model.
 */
export class Model {
  /**
   * Creates a new model.
   * @param name - The name of the model to use.
   * @param provider - The provider to use to invoke the model.
   * @param options - The options to pass to the model.
   */
  constructor(
    // eslint-disable-next-line no-unused-vars
    readonly name: string,
    // eslint-disable-next-line no-unused-vars
    readonly provider: ModelProvider,
    // eslint-disable-next-line no-unused-vars
    readonly options?: Record<string, unknown>,
  ) {}

  /**
   * Invokes the model with the given messages.
   * @param messages - The messages to send to the model.
   * @param tools - The tools to use to invoke the model.
   * @returns The response from the model.
   */
  invoke(context: ModelContext) {
    const messages: Message[] = [];
    if (context.prompt) {
      messages.push({ role: "system", content: [{ type: "text", text: context.prompt }] });
    }
    messages.push(...context.messages);
    const options = { ...this.options, ...context.options };
    return this.provider.invoke({
      model: this.name,
      options,
      messages: messages,
      tools: context.tools,
      signal: context.signal,
    });
  }
}
