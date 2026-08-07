import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { applyPatchTool } from "../apply-patch";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "helixent-apply-patch-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("applyPatchTool", () => {
  test("applies a simple patch to an existing file", async () => {
    const filePath = join(tempDir, "demo.txt");
    await writeFile(filePath, "alpha\nbeta\n");

    const patch = [
      `--- ${filePath}`,
      `+++ ${filePath}`,
      "@@ -1,2 +1,2 @@",
      " alpha",
      "-beta",
      "+gamma",
      "",
    ].join("\n");

    const result = await applyPatchTool.invoke({ description: "Patch demo file", patch });
    expect(result).toMatchObject({
      ok: true,
      data: {
        fileCount: 1,
        changedFiles: [filePath],
      },
    });

    expect(await readFile(filePath, "utf8")).toBe("alpha\ngamma\n");
  });

  test("places zero-length insertion hunks after oldStart", async () => {
    const filePath = join(tempDir, "demo.txt");
    await writeFile(filePath, "alpha\nbeta\n");

    const patch = [
      `--- ${filePath}`,
      `+++ ${filePath}`,
      "@@ -1,0 +2,1 @@",
      "+inserted",
      "",
    ].join("\n");

    const result = await applyPatchTool.invoke({ description: "Insert a line after alpha", patch });
    expect(result).toMatchObject({ ok: true });
    expect(await readFile(filePath, "utf8")).toBe("alpha\ninserted\nbeta\n");
  });

  test("rejects file deletion patches", async () => {
    const filePath = join(tempDir, "demo.txt");
    const patch = [
      `--- ${filePath}`,
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-hello",
      "",
    ].join("\n");

    const result = await applyPatchTool.invoke({ description: "Delete file", patch });
    expect(result).toMatchObject({
      ok: false,
      code: "DELETE_NOT_SUPPORTED",
    });
  });

  test("fails when hunk counts do not match contents", async () => {
    const filePath = join(tempDir, "demo.txt");
    await writeFile(filePath, "alpha\nbeta\n");

    const patch = [
      `--- ${filePath}`,
      `+++ ${filePath}`,
      "@@ -1,1 +1,1 @@",
      " alpha",
      "-beta",
      "+gamma",
      "",
    ].join("\n");

    const result = await applyPatchTool.invoke({ description: "Bad hunk counts", patch });
    expect(result).toMatchObject({
      ok: false,
      code: "PATCH_APPLY_FAILED",
    });
    if (!result.ok) {
      expect(result.error).toContain("Hunk count mismatch");
    }
  });

  test("rejects out-of-order hunks instead of applying them at the current cursor", async () => {
    const filePath = join(tempDir, "demo.txt");
    const original = "alpha\nbeta\ngamma\n";
    await writeFile(filePath, original);

    const patch = [
      `--- ${filePath}`,
      `+++ ${filePath}`,
      "@@ -2,1 +2,1 @@",
      "-beta",
      "+BETA",
      "@@ -1,0 +2,1 @@",
      "+late-insertion",
      "",
    ].join("\n");

    const result = await applyPatchTool.invoke({ description: "Reject invalid hunk order", patch });
    expect(result).toMatchObject({
      ok: false,
      code: "PATCH_APPLY_FAILED",
    });
    if (!result.ok) {
      expect(result.error).toContain("out of order");
    }
    expect(await readFile(filePath, "utf8")).toBe(original);
  });
});
