import { join } from "node:path";

import { Command } from "commander";
import { render } from "ink";

import { validateIntegrity } from "@/cli/bootstrap";
import { registerCommands } from "@/cli/commands";
import { loadConfig } from "@/cli/config";
import { listSessions, loadSession } from "@/cli/sessions";
import { SettingsLoader, SettingsWriter } from "@/cli/settings";
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
  .version(HELIXENT_VERSION, "-v, --version");

registerCommands(program);

const args = process.argv.slice(2);

// Parse `--resume [sessionId]` manually so the TUI can boot without triggering
// commander's default "no subcommand → print help" exit. Any other non-empty
// argv is passed to commander for subcommand dispatch (e.g. `config`).
function parseResumeFlag(argv: string[]): { present: boolean; sessionId?: string } {
  const idx = argv.indexOf("--resume");
  if (idx === -1) return { present: false };
  const next = argv[idx + 1];
  const sessionId = next && !next.startsWith("-") ? next : undefined;
  return { present: true, sessionId };
}

const resumeFlag = parseResumeFlag(args);
const remainingArgs = args.filter((arg, i) => {
  if (arg === "--resume") return false;
  if (resumeFlag.sessionId && i > 0 && args[i - 1] === "--resume") return false;
  return true;
});

if (remainingArgs.length > 0) {
  await program.parseAsync(process.argv);
} else {
  console.info();
  await validateIntegrity();

  // Session lookup requires HELIXENT_HOME, which validateIntegrity() ensures.
  let sessionId: string | undefined;
  let sessionCreatedAt: string | undefined;
  let resumeMessages: NonSystemMessage[] | undefined;

  if (resumeFlag.present) {
    const session = resumeFlag.sessionId ? loadSession(resumeFlag.sessionId) : listSessions()[0];
    if (!session) {
      const hint = resumeFlag.sessionId
        ? `Session "${resumeFlag.sessionId}" not found.`
        : "No saved sessions found.";
      console.error(hint);
      process.exit(1);
    }
    sessionId = session.id;
    sessionCreatedAt = session.createdAt;
    resumeMessages = session.messages;
    console.info(`Resuming session ${session.id} (${session.messages.length} messages)\n`);
  }

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
  const agent = await createCodingAgent({
    model,
    skillsDirs,
    askUser: globalApprovalManager.askUser,
    askUserQuestion: globalAskUserQuestionManager.askUserQuestion,
    approvalPersistence: {
      loadAllowList: (cwd) => settingsLoader.loadAllowList(cwd),
      persistAllowedTool: (cwd, toolName) => settingsWriter.appendAllowedTool(cwd, toolName),
    },
    resumeMessages,
  });
  const commands: SlashCommand[] = await loadAvailableCommands(skillsDirs);

  render(
    <AgentLoopProvider
      agent={agent}
      commands={commands}
      sessionId={sessionId}
      sessionCreatedAt={sessionCreatedAt}
      initialMessages={resumeMessages}
    >
      <App commands={commands} supportProjectWideAllow />
    </AgentLoopProvider>,
    { patchConsole: false },
  );
}
