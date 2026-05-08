import { join } from "node:path";

import { Command } from "commander";
import { render } from "ink";

import { validateIntegrity } from "@/cli/bootstrap";
import { registerCommands } from "@/cli/commands";
import { loadConfig } from "@/cli/config";
import { SettingsLoader, SettingsWriter } from "@/cli/settings";
import { getLatestSessionPath, getProjectDir, loadTranscript } from "@/agent/transcript";
import { createCodingAgent, globalApprovalManager, globalAskUserQuestionManager } from "@/coding";
import { AnthropicModelProvider } from "@/community/anthropic";
import { OpenAIModelProvider } from "@/community/openai";
import type { ModelProvider, NonSystemMessage } from "@/foundation";
import { Model } from "@/foundation";

import { App } from "./tui";
import { loadAvailableCommands, type SlashCommand } from "./tui/command-registry";
import { AgentLoopProvider } from "./tui/hooks/use-agent-loop";
import { HELIXENT_NAME, HELIXENT_VERSION } from "./version";

const program = new Command();
program
  .name(HELIXENT_NAME)
  .description("Helixent — a blue rabbit that writes code")
  .version(HELIXENT_VERSION, "-v, --version")
  .option("--resume [sessionId]", "Resume a previous session");

registerCommands(program);

const args = process.argv.slice(2);

if (args.length > 0 && !args.some((a) => a.startsWith("--resume"))) {
  await program.parseAsync(process.argv);
} else {
  // Extract --resume option manually to avoid Commander showing help and exiting
  const resumeIdx = args.findIndex((a) => a === "--resume");
  const resumeOpt: string | true | undefined = resumeIdx >= 0
    ? (args[resumeIdx + 1] && !args[resumeIdx + 1]!.startsWith("-") ? args[resumeIdx + 1] : true)
    : undefined;

  console.info();
  await validateIntegrity();

  const config = loadConfig();
  const defaultModelName = config.defaultModel ?? config.models[0]?.name;
  const entry = defaultModelName ? config.models.find((m) => m.name === defaultModelName) : undefined;
  if (!entry) {
    throw new Error("No models configured. Run `helixent config model add` to add one.");
  }

  let provider: ModelProvider;
  if (entry.provider === "anthropic") {
    provider = new AnthropicModelProvider({
      baseURL: entry.baseURL,
      apiKey: entry.APIKey,
    });
  } else {
    provider = new OpenAIModelProvider({
      baseURL: entry.baseURL,
      apiKey: entry.APIKey,
    });
  }

  const model = new Model(entry.name, provider, {
    max_tokens: 16 * 1024,
    thinking: {
      type: "enabled",
    },
  });

  const skillsDirs = [
    join(process.cwd(), "skills"),
    join(process.cwd(), ".agents/skills"),
    join(Bun.env.HELIXENT_HOME!, "skills"),
    "~/.agents/skills",
    "~/.helixent/skills",
  ];

  const settingsLoader = new SettingsLoader();
  const settingsWriter = new SettingsWriter(settingsLoader);

  // Load resume messages if --resume was passed
  let resumeMessages: NonSystemMessage[] = [];
  if (resumeOpt) {
    const cwd = process.cwd();
    if (typeof resumeOpt === "string") {
      const sessionPath = join(getProjectDir(cwd), `${resumeOpt}.jsonl`);
      resumeMessages = loadTranscript(sessionPath);
    } else {
      const latestPath = getLatestSessionPath(cwd);
      if (latestPath) {
        resumeMessages = loadTranscript(latestPath);
      }
    }
    if (resumeMessages.length > 0) {
      console.info(`Resuming session with ${resumeMessages.length} messages.`);
    } else {
      console.info("No previous session found. Starting fresh.");
    }
  }

  const agent = await createCodingAgent({
    model,
    skillsDirs,
    askUser: globalApprovalManager.askUser,
    askUserQuestion: globalAskUserQuestionManager.askUserQuestion,
    approvalPersistence: {
      loadAllowList: (cwd) => settingsLoader.loadAllowList(cwd),
      persistAllowedTool: (cwd, toolName) => settingsWriter.appendAllowedTool(cwd, toolName),
    },
  });
  const commands: SlashCommand[] = await loadAvailableCommands(skillsDirs);

  // Inject resume messages into agent
  if (resumeMessages.length > 0) {
    for (const msg of resumeMessages) {
      agent.messages.push(msg);
    }
  }

  render(
    <AgentLoopProvider agent={agent} commands={commands}>
      <App commands={commands} supportProjectWideAllow />
    </AgentLoopProvider>,
    { patchConsole: false },
  );
}
