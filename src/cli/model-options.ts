import type { ModelEntry } from "./config";

const DEFAULT_MAX_TOKENS = 16 * 1024;
const DEFAULT_ANTHROPIC_THINKING_BUDGET_TOKENS = 8 * 1024;

export function defaultModelOptionsForProvider(provider: ModelEntry["provider"]): Record<string, unknown> {
  if (provider === "anthropic") {
    return {
      max_tokens: DEFAULT_MAX_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: DEFAULT_ANTHROPIC_THINKING_BUDGET_TOKENS,
      },
    };
  }

  return {
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}
