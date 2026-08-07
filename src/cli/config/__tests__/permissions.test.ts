import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureHelixentHomeDirectory, getConfigFilePath, saveConfig } from "../index";

const temporaryRoots: string[] = [];
const unixTest = process.platform === "win32" ? test.skip : test;

function setHelixentHome(path: string) {
  process.env.HELIXENT_HOME = path;
  Bun.env.HELIXENT_HOME = path;
}

afterEach(async () => {
  delete process.env.HELIXENT_HOME;
  delete Bun.env.HELIXENT_HOME;

  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("config filesystem permissions", () => {
  unixTest("creates HELIXENT_HOME with owner-only permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "helixent-config-"));
    temporaryRoots.push(root);
    const home = join(root, "home");
    setHelixentHome(home);

    ensureHelixentHomeDirectory();

    const mode = (await stat(home)).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  unixTest("writes config.yaml with owner-only permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "helixent-config-"));
    temporaryRoots.push(root);
    const home = join(root, "home");
    setHelixentHome(home);
    ensureHelixentHomeDirectory();

    saveConfig({
      models: [
        {
          name: "test-model",
          baseURL: "https://example.com/v1",
          APIKey: "secret-test-key",
          provider: "openai",
        },
      ],
      defaultModel: "test-model",
    });

    const mode = (await stat(getConfigFilePath())).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
