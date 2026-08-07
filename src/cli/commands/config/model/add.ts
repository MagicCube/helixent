import type { Command } from "commander";

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
        const config = loadConfig();
        models = config.models;
        defaultModel = config.defaultModel;
      } else {
        models = [];
      }

      const entry = await runModelWizard();
      models.push(entry);
      saveConfig({ models, defaultModel: defaultModel ?? entry.name });
      console.info(`\nModel "${entry.name}" added. Config saved to: ${getConfigFilePath()}`);
    });
}
