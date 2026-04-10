import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { writeFileTool } from "../write-file";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "helixent-write-file-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("writeFileTool", () => {
  test("writes content to an absolute path", async () => {
    const filePath = join(tempDir, "out.txt");

    const result = await writeFileTool.invoke({
      description: "Create demo file",
      path: filePath,
      content: "hello\nworld\n",
    });

    expect(result).toBeUndefined();
    await expect(readFile(filePath, "utf8")).resolves.toBe("hello\nworld\n");
  });

  test("overwrites an existing file", async () => {
    const filePath = join(tempDir, "mutable.txt");
    await writeFile(filePath, "before\n");

    await writeFileTool.invoke({
      description: "Overwrite file",
      path: filePath,
      content: "after\n",
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("after\n");
  });

  test("writes into an existing subdirectory", async () => {
    const subDir = join(tempDir, "nested");
    await mkdir(subDir, { recursive: true });
    const filePath = join(subDir, "deep.txt");

    await writeFileTool.invoke({
      description: "Write nested file",
      path: filePath,
      content: "nested\n",
    });

    await expect(readFile(filePath, "utf8")).resolves.toBe("nested\n");
  });
});
