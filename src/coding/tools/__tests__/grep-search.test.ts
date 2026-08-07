import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { grepSearchTool } from "../grep-search";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "helixent-grep-search-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("grepSearchTool", () => {
  test("returns structured error for invalid directory", async () => {
    const result = await grepSearchTool.invoke({
      description: "Search missing directory",
      path: join(tempDir, "missing-dir"),
      pattern: "needle",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_DIRECTORY",
    });
  });

  test("finds matches with ripgrep when available", async () => {
    await writeFile(join(tempDir, "alpha.txt"), "needle\nother\n");
    await writeFile(join(tempDir, "beta.txt"), "NEEDLE\n");

    const result = await grepSearchTool.invoke({
      description: "Search for needle",
      path: tempDir,
      pattern: "needle",
    });

    if (!result.ok && result.code === "RG_NOT_FOUND") {
      expect(result.error).toContain("ripgrep");
      return;
    }

    expect(result).toMatchObject({
      ok: true,
      data: {
        path: tempDir,
        pattern: "needle",
        totalMatches: 2,
        shownMatches: 2,
        caseSensitive: false,
      },
    });

    if (result.ok) {
      expect(result.data!.matches.some((line) => line.includes("alpha.txt:1:needle"))).toBe(true);
      expect(result.data!.matches.some((line) => line.includes("beta.txt:1:NEEDLE"))).toBe(true);
    }
  });

  test("treats a dash-prefixed pattern as search data instead of an rg option", async () => {
    await writeFile(join(tempDir, "flags.txt"), "-needle\nother\n");

    const result = await grepSearchTool.invoke({
      description: "Search for dash-prefixed text",
      path: tempDir,
      pattern: "-needle",
      caseSensitive: true,
    });

    if (!result.ok && result.code === "RG_NOT_FOUND") {
      expect(result.error).toContain("ripgrep");
      return;
    }

    expect(result).toMatchObject({
      ok: true,
      data: {
        pattern: "-needle",
        totalMatches: 1,
        shownMatches: 1,
        caseSensitive: true,
      },
    });
    if (result.ok) {
      expect(result.data!.matches[0]).toContain("flags.txt:1:-needle");
    }
  });
});
