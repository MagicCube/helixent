import { OpenAI } from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources";

import type { Message, ModelProvider, Tool } from "@/foundation";

import { convertToOpenAIMessages, convertToOpenAITools, parseAssistantMessage } from "./utils";

function toTokenUsage(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}) {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

/**
 * A provider for the OpenAI API.
 */
export class OpenAIModelProvider implements ModelProvider {
  _client: OpenAI;

  constructor({ baseURL, apiKey }: { baseURL?: string; apiKey?: string } = {}) {
    this._client = new OpenAI({
      baseURL,
      apiKey,
    });
  }

  async invoke({
    model,
    messages,
    tools,
    options,
    signal,
  }: {
    model: string;
    messages: Message[];
    tools?: Tool[];
    options?: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const params = {
      model,
      messages: convertToOpenAIMessages(messages),
      tools: tools ? convertToOpenAITools(tools) : undefined,
      temperature: 0,
      top_p: 0,
      ...options,
    } satisfies ChatCompletionCreateParamsNonStreaming;
    const response = await this._client.chat.completions.create(params, { signal });
    return parseAssistantMessage(response.choices[0]!.message!, toTokenUsage(response.usage));
  }
}
