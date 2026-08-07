import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { SettingsLoader } from "../settings-loader";
import { SettingsWriter } from "../settings-writer";

let baseDir: string;
let helixHome: string;
let projectDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "helixent-settings-"));
  helixHome = join(baseDir, "helixent-home");
  projectDir = join(baseDir, "project");
  await mkdir(helixHome, { recursive: true });
  await mkdir(join(projectDir, ".helixent"), { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("SettingsLoader", () => {
  test("loadAllowList ignores repo-controlled grants and trusts user-owned project approvals", async () => {
    await writeFile(join(helixHome, "settings.json"), JSON.stringify({ permissions: { allow: ["bash"] } }), "utf8");
    await writeFile(
      join(projectDir, ".helixent", "settings.json"),
      JSON.stringify({ permissions: { allow: ["write_file"] } }),
      "utf8",
    );
    await writeFile(
      join(projectDir, ".helixent", "settings.local.json"),
      JSON.stringify({ permissions: { allow: ["str_replace"] } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const trustedProjectPath = loader.projectLocalSettingsPath(projectDir);
    expect(trustedProjectPath.startsWith(helixHome)).toBe(true);
    expect(trustedProjectPath.startsWith(projectDir)).toBe(false);
    await mkdir(dirname(trustedProjectPath), { recursive: true });
    await writeFile(trustedProjectPath, JSON.stringify({ permissions: { allow: ["apply_patch"] } }), "utf8");

    const allowed = await loader.loadAllowList(projectDir);
    expect([...allowed].sort()).toEqual(["apply_patch", "bash"].sort());
  });

  test("ignores invalid user layer and does not trust project permission grants", async () => {
    await writeFile(join(helixHome, "settings.json"), "{ not valid json", "utf8");
    await writeFile(
      join(projectDir, ".helixent", "settings.json"),
      JSON.stringify({ permissions: { allow: ["grep_search"] } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const allowed = await loader.loadAllowList(projectDir);
    expect([...allowed]).toEqual([]);
  });

  test("repo-local layers still merge non-allow settings", async () => {
    await writeFile(
      join(helixHome, "settings.json"),
      JSON.stringify({ permissions: { allow: ["a"], customKey: "fromUser" } }),
      "utf8",
    );
    await writeFile(
      join(projectDir, ".helixent", "settings.local.json"),
      JSON.stringify({ permissions: { allow: ["write_file"], customKey: "fromLocal" } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const merged = await loader.load(projectDir);
    expect(merged.permissions?.allow?.sort()).toEqual(["a"]);
    expect((merged.permissions as Record<string, unknown>).customKey).toBe("fromLocal");
  });
});

describe("SettingsWriter", () => {
  test("appendAllowedTool writes project approval state under HELIXENT_HOME", async () => {
    const loader = new SettingsLoader(helixHome);
    const writer = new SettingsWriter(loader);
    await writer.appendAllowedTool(projectDir, "bash");

    const trustedPath = loader.projectLocalSettingsPath(projectDir);
    expect(trustedPath.startsWith(helixHome)).toBe(true);
    expect(trustedPath.startsWith(projectDir)).toBe(false);
    const raw = await Bun.file(trustedPath).text();
    expect(JSON.parse(raw)).toMatchObject({ permissions: { allow: ["bash"] } });

    const repoLocalPath = join(projectDir, ".helixent", "settings.local.json");
    expect(await Bun.file(repoLocalPath).exists()).toBe(false);

    if (process.platform !== "win32") {
      expect((await stat(dirname(trustedPath))).mode & 0o777).toBe(0o700);
      expect((await stat(trustedPath)).mode & 0o777).toBe(0o600);
    }
  });

  test("appendAllowedTool rejects a nonexistent project cwd without creating it", async () => {
    const missingProject = join(baseDir, "missing-project");
    const loader = new SettingsLoader(helixHome);
    const writer = new SettingsWriter(loader);

    await expect(writer.appendAllowedTool(missingProject, "bash")).rejects.toThrow("must exist and be a directory");
    await expect(stat(missingProject)).rejects.toThrow();
  });
});
