import type { ModelEntry } from "@/cli/config";
import { AnthropicModelProvider } from "@/community/anthropic";
import { OpenAIModelProvider } from "@/community/openai";
import type { ModelProvider } from "@/foundation";
import { Model } from "@/foundation";

export function buildModelFromEntry(entry: ModelEntry): Model {
  let provider: ModelProvider;
  if (entry.provider === "anthropic") {
    provider = new AnthropicModelProvider({
      baseURL: entry.baseURL,
      apiKey: entry.APIKey,
    });
  } else {
    provider = new OpenAIModelProvider({
      baseURL: entry.baseURL,
      apiKey: entry.APIKey,
    });
  }

  return new Model(entry.name, provider, {
    max_tokens: 16 * 1024,
    thinking: {
      type: "enabled",
    },
  });
}
