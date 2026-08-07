import { afterEach, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Command } from "commander";

import { loadConfig } from "@/cli/config";

const runModelWizard = mock(async () => ({
  name: "new-model",
  baseURL: "https://example.com/v1",
  APIKey: "new-secret",
  provider: "openai" as const,
}));

mock.module("@/cli/bootstrap", () => ({ runModelWizard }));

const { registerAddCommand } = await import("../add");

const temporaryRoots: string[] = [];

afterEach(async () => {
  runModelWizard.mockClear();
  delete process.env.HELIXENT_HOME;
  delete Bun.env.HELIXENT_HOME;
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("does not overwrite an existing invalid config when adding a model", async () => {
  const root = await mkdtemp(join(tmpdir(), "helixent-model-add-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  process.env.HELIXENT_HOME = home;
  Bun.env.HELIXENT_HOME = home;

  const configPath = join(home, "config.yaml");
  const invalidConfig = [
    "models:",
    "  - name: existing-model",
    "    baseURL: ''",
    "    APIKey: existing-secret",
    "defaultModel: existing-model",
    "",
  ].join("\n");
  await writeFile(configPath, invalidConfig, "utf8");

  const program = new Command();
  program.exitOverride();
  registerAddCommand(program);

  await expect(program.parseAsync(["node", "helixent", "add"])).rejects.toThrow();
  expect(runModelWizard).not.toHaveBeenCalled();
  expect(await readFile(configPath, "utf8")).toBe(invalidConfig);
});

test("allows adding the first model when an existing config has models empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "helixent-model-add-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  process.env.HELIXENT_HOME = home;
  Bun.env.HELIXENT_HOME = home;

  await writeFile(join(home, "config.yaml"), "models: []\n", "utf8");

  const program = new Command();
  program.exitOverride();
  registerAddCommand(program);
  await program.parseAsync(["node", "helixent", "add"]);

  expect(runModelWizard).toHaveBeenCalledTimes(1);
  expect(loadConfig()).toMatchObject({
    models: [{ name: "new-model", baseURL: "https://example.com/v1", provider: "openai" }],
    defaultModel: "new-model",
  });
});
