import { describe, expect, test } from "bun:test";

import { helixentConfigSchema, modelEntrySchema } from "../schema";

describe("modelEntrySchema", () => {
  test("accepts valid model entry with required fields", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      APIKey: "sk-xxx",
    });
    expect(result.success).toBe(true);
  });

  test("accepts model entry with explicit openai provider", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      APIKey: "sk-xxx",
      provider: "openai",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("openai");
    }
  });

  test("accepts model entry with anthropic provider", () => {
    const result = modelEntrySchema.safeParse({
      name: "claude-3",
      baseURL: "https://api.anthropic.com",
      APIKey: "sk-ant-xxx",
      provider: "anthropic",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("anthropic");
    }
  });

  test("defaults provider to openai when not specified", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      APIKey: "sk-xxx",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("openai");
    }
  });

  test("rejects empty name", () => {
    const result = modelEntrySchema.safeParse({
      name: "",
      baseURL: "https://api.openai.com/v1",
      APIKey: "sk-xxx",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty baseURL", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "",
      APIKey: "sk-xxx",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty APIKey", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      APIKey: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid provider", () => {
    const result = modelEntrySchema.safeParse({
      name: "gpt-4",
      baseURL: "https://api.openai.com/v1",
      APIKey: "sk-xxx",
      provider: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("helixentConfigSchema", () => {
  test("accepts valid config with models", () => {
    const result = helixentConfigSchema.safeParse({
      models: [
        { name: "gpt-4", baseURL: "https://api.openai.com/v1", APIKey: "sk-xxx" },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts config with defaultModel matching a model name", () => {
    const result = helixentConfigSchema.safeParse({
      models: [
        { name: "gpt-4", baseURL: "https://api.openai.com/v1", APIKey: "sk-xxx" },
      ],
      defaultModel: "gpt-4",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty models array", () => {
    const result = helixentConfigSchema.safeParse({ models: [] });
    expect(result.success).toBe(false);
  });

  test("rejects defaultModel that does not match any model name", () => {
    const result = helixentConfigSchema.safeParse({
      models: [
        { name: "gpt-4", baseURL: "https://api.openai.com/v1", APIKey: "sk-xxx" },
      ],
      defaultModel: "nonexistent",
    });
    expect(result.success).toBe(false);
  });

  test("accepts multiple models", () => {
    const result = helixentConfigSchema.safeParse({
      models: [
        { name: "gpt-4", baseURL: "https://api.openai.com/v1", APIKey: "sk-xxx" },
        { name: "claude-3", baseURL: "https://api.anthropic.com", APIKey: "sk-ant-xxx", provider: "anthropic" },
      ],
      defaultModel: "claude-3",
    });
    expect(result.success).toBe(true);
  });
});
