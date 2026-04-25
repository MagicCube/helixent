import { OpenAI } from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources";

import type { AssistantMessage, Message, ModelProvider, Tool } from "@/foundation";

import { StreamAccumulator } from "./stream-utils";
import { convertToOpenAIMessages, convertToOpenAITools, parseAssistantMessage } from "./utils";

function toTokenUsage(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
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
      ...this._baseChatCompletionParams({ model, messages, tools, options }),
    } satisfies ChatCompletionCreateParamsNonStreaming;
    const response = await this._client.chat.completions.create(params, { signal });
    return parseAssistantMessage(response.choices[0]!.message!, toTokenUsage(response.usage));
  }

  async *stream({
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
  }): AsyncGenerator<AssistantMessage> {
    const response = await this._client.chat.completions.create(
      {
        ...this._baseChatCompletionParams({ model, messages, tools, options }),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal },
    );

    const acc = new StreamAccumulator();
    for await (const chunk of response) {
      acc.push(chunk);
      yield acc.snapshot();
    }
  }

  private _baseChatCompletionParams({
    model,
    messages,
    tools,
    options,
  }: {
    model: string;
    messages: Message[];
    tools?: Tool[];
    options?: Record<string, unknown>;
  }) {
    return {
      model,
      messages: convertToOpenAIMessages(messages),
      tools: tools ? convertToOpenAITools(tools) : undefined,
      temperature: 0,
      top_p: 1,
      ...options,
    };
  }
}
