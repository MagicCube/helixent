import { afterEach, expect, mock, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runFirstRunWizard = mock(async () => ({
  models: [
    {
      name: "replacement-model",
      baseURL: "https://example.com/v1",
      APIKey: "replacement-key",
      provider: "openai" as const,
    },
  ],
  defaultModel: "replacement-model",
}));

mock.module("../first-run-wizard", () => ({ runFirstRunWizard }));

const { validateIntegrity } = await import("../integrity");

const temporaryRoots: string[] = [];

async function createHome(configContent: string) {
  const root = await mkdtemp(join(tmpdir(), "helixent-integrity-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  process.env.HELIXENT_HOME = home;
  Bun.env.HELIXENT_HOME = home;
  const configPath = join(home, "config.yaml");
  await writeFile(configPath, configContent, "utf8");
  return { home, configPath };
}

afterEach(async () => {
  runFirstRunWizard.mockClear();
  delete process.env.HELIXENT_HOME;
  delete Bun.env.HELIXENT_HOME;
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("preserves validation errors for non-empty invalid configs", async () => {
  const invalidConfig = [
    "models:",
    "  - name: broken-model",
    "    baseURL: ''",
    "    APIKey: secret",
    "defaultModel: broken-model",
    "",
  ].join("\n");
  const { configPath } = await createHome(invalidConfig);

  await expect(validateIntegrity()).rejects.toThrow();
  expect(runFirstRunWizard).not.toHaveBeenCalled();
  expect(await readFile(configPath, "utf8")).toBe(invalidConfig);
});

test("preserves an existing config whose YAML value is not an object", async () => {
  const invalidConfig = "null\n";
  const { configPath } = await createHome(invalidConfig);

  await expect(validateIntegrity()).rejects.toThrow();
  expect(runFirstRunWizard).not.toHaveBeenCalled();
  expect(await readFile(configPath, "utf8")).toBe(invalidConfig);
});

test("preserves malformed YAML instead of replacing it through bootstrap", async () => {
  const invalidConfig = "models: [\n";
  const { configPath } = await createHome(invalidConfig);

  await expect(validateIntegrity()).rejects.toThrow();
  expect(runFirstRunWizard).not.toHaveBeenCalled();
  expect(await readFile(configPath, "utf8")).toBe(invalidConfig);
});

test("still bootstraps the explicit empty-models recovery state", async () => {
  await createHome("models: []\n");

  await validateIntegrity();
  expect(runFirstRunWizard).toHaveBeenCalledTimes(1);
});
