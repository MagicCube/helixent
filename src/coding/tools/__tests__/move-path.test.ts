import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { movePathTool } from "../move-path";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "helixent-move-path-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("movePathTool", () => {
  test("moves a file to a new path", async () => {
    const from = join(tempDir, "from.txt");
    const to = join(tempDir, "to.txt");
    await writeFile(from, "payload\n");

    const result = await movePathTool.invoke({
      description: "Rename demo file",
      from,
      to,
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        from,
        to,
      },
    });

    await expect(readFile(to, "utf8")).resolves.toBe("payload\n");
  });

  test("refuses to overwrite an existing target file", async () => {
    const from = join(tempDir, "from.txt");
    const to = join(tempDir, "to.txt");
    await writeFile(from, "source\n");
    await writeFile(to, "keep-me\n");

    const result = await movePathTool.invoke({
      description: "Do not overwrite target",
      from,
      to,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TARGET_EXISTS",
    });
    await expect(readFile(from, "utf8")).resolves.toBe("source\n");
    await expect(readFile(to, "utf8")).resolves.toBe("keep-me\n");
  });

  test("returns structured error for relative source path", async () => {
    const result = await movePathTool.invoke({
      description: "Move invalid source",
      from: "from.txt",
      to: join(tempDir, "to.txt"),
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_SOURCE_PATH",
    });
  });
});
