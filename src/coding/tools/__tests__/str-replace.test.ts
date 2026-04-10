import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { strReplaceTool } from "../str-replace";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "helixent-str-replace-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("strReplaceTool", () => {
  test("replaces all occurrences when count is omitted", async () => {
    const filePath = join(tempDir, "multi.txt");
    await writeFile(filePath, "a x b x c\n");

    const result = await strReplaceTool.invoke({
      description: "Replace every x",
      path: filePath,
      old: "x",
      new: "y",
    });

    expect(result).toEqual({
      ok: true,
      path: filePath,
      replacements: 2,
      changed: true,
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("a y b y c\n");
  });

  test("replaces at most count occurrences", async () => {
    const filePath = join(tempDir, "limited.txt");
    await writeFile(filePath, "one two one three\n");

    const result = await strReplaceTool.invoke({
      description: "Replace first one only",
      path: filePath,
      old: "one",
      new: "ONE",
      count: 1,
    });

    expect(result).toEqual({
      ok: true,
      path: filePath,
      replacements: 1,
      changed: true,
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("ONE two one three\n");
  });

  test("returns unchanged when count is zero", async () => {
    const filePath = join(tempDir, "zero.txt");
    await writeFile(filePath, "abc\n");

    const result = await strReplaceTool.invoke({
      description: "No-op count",
      path: filePath,
      old: "b",
      new: "Z",
      count: 0,
    });

    expect(result).toEqual({
      ok: true,
      path: filePath,
      replacements: 0,
      changed: false,
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("abc\n");
  });

  test("returns error when file is missing", async () => {
    const filePath = join(tempDir, "missing.txt");

    const result = await strReplaceTool.invoke({
      description: "Replace in missing file",
      path: filePath,
      old: "a",
      new: "b",
    });

    expect(result).toEqual({
      ok: false,
      error: `File ${filePath} does not exist.`,
    });
  });

  test("returns error when old is empty", async () => {
    const filePath = join(tempDir, "empty-old.txt");
    await writeFile(filePath, "x\n");

    const result = await strReplaceTool.invoke({
      description: "Invalid old string",
      path: filePath,
      old: "",
      new: "y",
    });

    expect(result).toEqual({
      ok: false,
      error: "`old` must be a non-empty string.",
    });
  });

  test("returns error when old is not found", async () => {
    const filePath = join(tempDir, "nofind.txt");
    await writeFile(filePath, "stable\n");

    const result = await strReplaceTool.invoke({
      description: "Missing needle",
      path: filePath,
      old: "nope",
      new: "yes",
    });

    expect(result).toEqual({
      ok: false,
      error: `No occurrences of 'old' found in ${filePath}.`,
    });
  });
});
