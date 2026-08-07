import type { ModelEntry } from "./config";

const DEFAULT_MAX_TOKENS = 16 * 1024;

export function defaultModelOptionsForProvider(provider: ModelEntry["provider"]): Record<string, unknown> {
  if (provider === "anthropic") {
    return {
      max_tokens: DEFAULT_MAX_TOKENS,
      thinking: {
        type: "enabled",
      },
    };
  }

  return {
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}
