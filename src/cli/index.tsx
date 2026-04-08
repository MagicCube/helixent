import { join } from "path";

import { render } from "ink";

import type { Agent } from "@/agent";
import { validateIntegrity } from "@/cli/bootstrap";
import { loadConfig } from "@/cli/config";
import { createCodingAgent } from "@/coding";
import { OpenAIModelProvider } from "@/community/openai";
import { Model } from "@/foundation";

import { App } from "./tui";
import { loadAvailableCommands, type SlashCommand } from "./tui/command-registry";
import { AgentLoopProvider } from "./tui/hooks/use-agent-loop";

let agent!: Agent;
let commands: SlashCommand[] = [];

async function setup() {
  const config = loadConfig();
  const entry = config.models[0];
  if (!entry) {
    throw new Error("No models configured. Run setup to create `config.yaml`.");
  }

  const provider = new OpenAIModelProvider({
    baseURL: entry.baseURL,
    apiKey: entry.APIKey,
  });

  const model = new Model(entry.name, provider, {
    max_tokens: 16 * 1024,
    thinking: {
      type: "enabled",
    },
  });

  const skillsDirs = [join(process.cwd(), "skills")];
  agent = await createCodingAgent({ model, skillsDirs });
  commands = await loadAvailableCommands(skillsDirs);
}

function main() {
  render(
    <AgentLoopProvider agent={agent}>
      <App commands={commands} />
    </AgentLoopProvider>,
  );
}

console.info();
await validateIntegrity();
await setup();
main();
