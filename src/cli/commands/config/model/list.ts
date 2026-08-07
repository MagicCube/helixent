import type { Command } from "commander";

import { ensureHelixentHomeEnv, isHelixentSetupComplete, loadConfig } from "@/cli/config";

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) {
    return "*".repeat(Math.max(4, apiKey.length));
  }
  return `****${apiKey.slice(-4)}`;
}

export function registerListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all configured models")
    .action(() => {
      ensureHelixentHomeEnv();

      if (!isHelixentSetupComplete()) {
        console.info("No models configured. Run `helixent config model add` to add one.");
        return;
      }

      const config = loadConfig();
      if (config.models.length === 0) {
        console.info("No models configured.");
        return;
      }

      const defaultName = config.defaultModel ?? config.models[0]?.name;
      console.info(`Default model: ${defaultName ?? "(none)"}\n`);
      console.info("Configured models:\n");
      for (const [i, m] of config.models.entries()) {
        const isDefault = defaultName ? defaultName === m.name : false;
        console.info(`  ${i + 1}. ${m.name}${isDefault ? " (default)" : ""}`);
        console.info(`     baseURL: ${m.baseURL}`);
        console.info(`     API Key: ${maskApiKey(m.APIKey)}`);
        console.info();
      }
      console.info(`\nThe default model is \`${defaultName}\`. To change the default model, run:
      \n  helixent config model set-default <model_name>\n`);
    });
}
