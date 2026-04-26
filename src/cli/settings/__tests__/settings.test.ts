import { describe, expect, test } from "bun:test";

import { appendToolToAllowList, settingsSchema } from "../settings";

describe("settingsSchema", () => {
  test("accepts valid settings with permissions", () => {
    const result = settingsSchema.safeParse({
      permissions: { allow: ["bash", "write_file"] },
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = settingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts unknown additional fields (passthrough)", () => {
    const result = settingsSchema.safeParse({
      permissions: { allow: ["bash"] },
      someOtherField: "value",
    });
    expect(result.success).toBe(true);
  });

  test("accepts permissions with additional fields (passthrough)", () => {
    const result = settingsSchema.safeParse({
      permissions: { allow: ["bash"], deny: ["dangerous"] },
    });
    expect(result.success).toBe(true);
  });
});

describe("appendToolToAllowList", () => {
  test("adds tool to empty allow list", () => {
    const result = appendToolToAllowList({}, "bash");
    expect(result).toMatchObject({
      permissions: { allow: ["bash"] },
    });
  });

  test("appends tool to existing allow list", () => {
    const result = appendToolToAllowList(
      { permissions: { allow: ["bash"] } },
      "write_file",
    );
    expect(result).toMatchObject({
      permissions: { allow: ["bash", "write_file"] },
    });
  });

  test("does not duplicate tool in allow list", () => {
    const result = appendToolToAllowList(
      { permissions: { allow: ["bash", "write_file"] } },
      "bash",
    );
    expect(result).toMatchObject({
      permissions: { allow: ["bash", "write_file"] },
    });
  });

  test("creates permissions object when it does not exist", () => {
    const result = appendToolToAllowList({ otherKey: "value" }, "bash");
    expect(result).toMatchObject({
      otherKey: "value",
      permissions: { allow: ["bash"] },
    });
  });

  test("handles non-object permissions gracefully", () => {
    const result = appendToolToAllowList({ permissions: "invalid" }, "bash");
    expect(result).toMatchObject({
      permissions: { allow: ["bash"] },
    });
  });

  test("handles array permissions gracefully", () => {
    const result = appendToolToAllowList({ permissions: ["not", "an", "object"] }, "bash");
    expect(result).toMatchObject({
      permissions: { allow: ["bash"] },
    });
  });

  test("filters non-string entries from existing allow list", () => {
    const result = appendToolToAllowList(
      { permissions: { allow: ["bash", 42, null, "write_file"] } },
      "str_replace",
    );
    expect(result).toMatchObject({
      permissions: { allow: ["bash", "write_file", "str_replace"] },
    });
  });

  test("preserves other fields in the document", () => {
    const result = appendToolToAllowList(
      { theme: "dark", version: 2, permissions: { allow: ["bash"] } },
      "write_file",
    );
    expect(result).toMatchObject({
      theme: "dark",
      version: 2,
      permissions: { allow: ["bash", "write_file"] },
    });
  });
});
