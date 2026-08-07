import { readFileSync } from "node:fs";

import type { Command } from "commander";
import { parse as yamlParse } from "yaml";

import { runModelWizard } from "@/cli/bootstrap";
import type { ModelEntry } from "@/cli/config";
import {
  ensureHelixentHomeDirectory,
  ensureHelixentHomeEnv,
  getConfigFilePath,
  isHelixentSetupComplete,
  loadConfig,
  saveConfig,
} from "@/cli/config";

function hasEmptyModelsConfig(): boolean {
  try {
    const raw = readFileSync(getConfigFilePath(), "utf8");
    const parsed: unknown = yamlParse(raw);
    const models = (parsed as { models?: unknown }).models;
    return Array.isArray(models) && models.length === 0;
  } catch {
    return false;
  }
}

export function registerAddCommand(parent: Command): void {
  parent
    .command("add")
    .description("Add a new model configuration")
    .action(async () => {
      ensureHelixentHomeEnv();
      ensureHelixentHomeDirectory();

      let models: ModelEntry[];
      let defaultModel: string | undefined;
      if (isHelixentSetupComplete()) {
        try {
          const config = loadConfig();
          models = config.models;
          defaultModel = config.defaultModel;
        } catch (error) {
          if (!hasEmptyModelsConfig()) {
            throw error;
          }
          models = [];
        }
      } else {
        models = [];
      }

      const entry = await runModelWizard();
      models.push(entry);
      saveConfig({ models, defaultModel: defaultModel ?? entry.name });
      console.info(`\nModel "${entry.name}" added. Config saved to: ${getConfigFilePath()}`);
    });
}
