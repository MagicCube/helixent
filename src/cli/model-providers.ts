export type ProviderType = "openai" | "anthropic";

export type ModelProviderConfig = {
  label: string;
  id: string;
  baseURL: string;
  providerType: ProviderType;
  defaultModelName?: string;
};

export function getDefaultModelOptions(modelName: string, providerType: ProviderType): {
  max_tokens: number;
  thinking?: { type: "adaptive" | "enabled" };
} {
  const options = { max_tokens: 16 * 1024 };
  if (modelName === "MiniMax-M3") {
    return providerType === "openai" ? { ...options, thinking: { type: "adaptive" } } : options;
  }
  if (modelName.startsWith("MiniMax-M2")) {
    return options;
  }
  return { ...options, thinking: { type: "enabled" } };
}

export const MODEL_PROVIDERS: ModelProviderConfig[] = [
  { label: "Anthropic (Claude)", id: "anthropic", baseURL: "https://api.anthropic.com", providerType: "anthropic" },
  { label: "OpenAI", id: "openai", baseURL: "https://api.openai.com/v1", providerType: "openai" },
  { label: "Volcengine - General", id: "volcengine", baseURL: "https://ark.cn-beijing.volces.com/api/v3", providerType: "openai" },
  {
    label: "Volcengine - Coding Plan",
    id: "volcengine_coding_plan",
    baseURL: "https://ark.cn-beijing.volces.com/api/coding/v3",
    providerType: "openai",
  },
  { label: "Qwen (Aliyun)", id: "qwen", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", providerType: "openai" },
  {
    label: "MiniMax (Domestic)",
    id: "minimax_cn",
    baseURL: "https://api.minimaxi.com/v1",
    providerType: "openai",
    defaultModelName: "MiniMax-M3",
  },
  {
    label: "MiniMax (Global)",
    id: "minimax_global",
    baseURL: "https://api.minimax.io/v1",
    providerType: "openai",
    defaultModelName: "MiniMax-M3",
  },
  {
    label: "MiniMax Anthropic (Domestic)",
    id: "minimax_anthropic_cn",
    baseURL: "https://api.minimaxi.com/anthropic",
    providerType: "anthropic",
    defaultModelName: "MiniMax-M3",
  },
  {
    label: "MiniMax Anthropic (Global)",
    id: "minimax_anthropic_global",
    baseURL: "https://api.minimax.io/anthropic",
    providerType: "anthropic",
    defaultModelName: "MiniMax-M3",
  },
  { label: "GLM (Zhipu AI)", id: "glm", baseURL: "https://open.bigmodel.cn/api/paas/v4", providerType: "openai" },
  { label: "Kimi (Moonshot)", id: "kimi", baseURL: "https://api.moonshot.cn/v1", providerType: "openai" },
  { label: "DeepSeek (OpenAI compatible)", id: "deepseek", baseURL: "https://api.deepseek.com/v1", providerType: "openai" },
  { label: "Other", id: "other", baseURL: "", providerType: "openai" },
];
