export type ModelProviderConfig = {
  label: string;
  id: string;
  baseURL: string;
};

export const MODEL_PROVIDERS: ModelProviderConfig[] = [
  { label: "OpenAI", id: "openai", baseURL: "https://api.openai.com/v1" },
  { label: "Volcengine - General", id: "volcengine", baseURL: "https://ark.cn-beijing.volces.com/api/v3" },
  {
    label: "Volcengine - Coding Plan",
    id: "volcengine_coding_plan",
    baseURL: "https://ark.cn-beijing.volces.com/api/coding/v3",
  },
  { label: "Qwen (Aliyun)", id: "qwen", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { label: "Minimax (Domestic)", id: "minimax_cn", baseURL: "https://api.minimaxi.com/v1" },
  { label: "Minimax (Global)", id: "minimax_global", baseURL: "https://api.minimax.io/v1" },
  { label: "GLM (Zhipu AI)", id: "glm", baseURL: "https://open.bigmodel.cn/api/paas/v4" },
  { label: "Kimi (Moonshot)", id: "kimi", baseURL: "https://api.moonshot.cn/v1" },
  { label: "DeepSeek (OpenAI compatible)", id: "deepseek", baseURL: "https://api.deepseek.com/v1" },
  { label: "Other", id: "other", baseURL: "" },
];
