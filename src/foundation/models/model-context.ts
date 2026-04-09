import type { NonSystemMessage } from "../messages";
import type { Tool } from "../tools";

export interface ModelContext {
  prompt: string;
  messages: NonSystemMessage[];
  /** The tools to use to invoke the model. */
  tools?: Tool[];
  /** The model-specific options override */
  options?: Record<string, unknown>;
  /** An abort signal to cancel the model invocation. */
  signal?: AbortSignal;
}
