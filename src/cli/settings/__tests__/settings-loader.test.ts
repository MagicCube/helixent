import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  test("loadAllowList unions permissions.allow from user, project, and local files", async () => {
    await writeFile(join(helixHome, "settings.json"), JSON.stringify({ permissions: { allow: ["bash"] } }), "utf8");
    await writeFile(
      join(projectDir, ".helixent", "settings.json"),
      JSON.stringify({ permissions: { allow: ["read_file"] } }),
      "utf8",
    );
    await writeFile(
      join(projectDir, ".helixent", "settings.local.json"),
      JSON.stringify({ permissions: { allow: ["write_file"] } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const allowed = await loader.loadAllowList(projectDir);
    expect([...allowed].sort()).toEqual(["bash", "read_file", "write_file"].sort());
  });

  test("ignores invalid user layer and still merges project and local", async () => {
    await writeFile(join(helixHome, "settings.json"), "{ not valid json", "utf8");
    await writeFile(
      join(projectDir, ".helixent", "settings.json"),
      JSON.stringify({ permissions: { allow: ["grep_search"] } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const allowed = await loader.loadAllowList(projectDir);
    expect([...allowed]).toEqual(["grep_search"]);
  });

  test("last layer wins for non-allow keys under permissions", async () => {
    await writeFile(
      join(helixHome, "settings.json"),
      JSON.stringify({ permissions: { allow: ["a"], customKey: "fromUser" } }),
      "utf8",
    );
    await writeFile(
      join(projectDir, ".helixent", "settings.local.json"),
      JSON.stringify({ permissions: { customKey: "fromLocal" } }),
      "utf8",
    );

    const loader = new SettingsLoader(helixHome);
    const merged = await loader.load(projectDir);
    expect(merged.permissions?.allow?.sort()).toEqual(["a"]);
    expect((merged.permissions as Record<string, unknown>).customKey).toBe("fromLocal");
  });
});

describe("SettingsWriter", () => {
  test("appendAllowedTool writes only to project settings.local.json", async () => {
    const loader = new SettingsLoader(helixHome);
    const writer = new SettingsWriter(loader);
    await writer.appendAllowedTool(projectDir, "bash");

    const localPath = join(projectDir, ".helixent", "settings.local.json");
    const raw = await Bun.file(localPath).text();
    const parsed: unknown = JSON.parse(raw);
    expect(parsed).toMatchObject({
      permissions: { allow: ["bash"] },
    });
  });
});
