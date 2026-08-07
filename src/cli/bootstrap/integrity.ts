import { readFileSync } from "node:fs";

import { parse as yamlParse } from "yaml";

import {
  ensureHelixentHomeDirectory,
  ensureHelixentHomeEnv,
  getConfigFilePath,
  isHelixentSetupComplete,
  loadConfig,
  saveConfig,
} from "@/cli/config";

import { runFirstRunWizard } from "./first-run-wizard";

function hasExplicitEmptyModelsConfig(): boolean {
  try {
    const raw = readFileSync(getConfigFilePath(), "utf8");
    const parsed: unknown = yamlParse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return false;
    }
    const models = (parsed as { models?: unknown }).models;
    return Array.isArray(models) && models.length === 0;
  } catch {
    return false;
  }
}

export async function validateIntegrity(): Promise<void> {
  ensureHelixentHomeEnv();

  // `models: []` is an explicit recoverable state: bootstrap can safely replace it.
  // Any other existing invalid config is preserved and its original validation/parsing
  // error is surfaced rather than silently overwriting user configuration.
  if (isHelixentSetupComplete()) {
    try {
      const config = loadConfig();
      if (config.models.length > 0) {
        return;
      }
    } catch (err) {
      if (!hasExplicitEmptyModelsConfig()) {
        throw err;
      }
    }
  }

  ensureHelixentHomeDirectory();
  try {
    const config = await runFirstRunWizard();
    saveConfig(config);
    console.info(`\n\nHelixent setup completed. Config saved to: ${getConfigFilePath()}\n\n`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
