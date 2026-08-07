import { afterEach, expect, mock, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

afterEach(async () => {
  runFirstRunWizard.mockClear();
  delete process.env.HELIXENT_HOME;
  delete Bun.env.HELIXENT_HOME;
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("preserves validation errors for non-empty invalid configs", async () => {
  const root = await mkdtemp(join(tmpdir(), "helixent-integrity-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  process.env.HELIXENT_HOME = home;
  Bun.env.HELIXENT_HOME = home;

  await writeFile(
    join(home, "config.yaml"),
    [
      "models:",
      "  - name: broken-model",
      "    baseURL: ''",
      "    APIKey: secret",
      "defaultModel: broken-model",
      "",
    ].join("\n"),
    "utf8",
  );

  await expect(validateIntegrity()).rejects.toThrow();
  expect(runFirstRunWizard).not.toHaveBeenCalled();
});

test("falls back to bootstrap when parsed YAML is not an inspectable object", async () => {
  const root = await mkdtemp(join(tmpdir(), "helixent-integrity-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  process.env.HELIXENT_HOME = home;
  Bun.env.HELIXENT_HOME = home;

  await writeFile(join(home, "config.yaml"), "null\n", "utf8");

  await validateIntegrity();
  expect(runFirstRunWizard).toHaveBeenCalledTimes(1);
});
