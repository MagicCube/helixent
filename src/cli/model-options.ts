const DEFAULT_MAX_TOKENS = 16 * 1024;

/**
 * Conservative CLI defaults that are valid across configured providers.
 * Provider/model-specific reasoning modes should be explicitly configured by
 * callers that know the selected model's capabilities.
 */
export function defaultModelOptions(): Record<string, unknown> {
  return {
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}
