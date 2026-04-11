import { listSkills } from "@/agent/skills/list-skills";
import type { SkillFrontmatter } from "@/agent/skills/types";

export interface SlashCommand {
  name: string;
  description: string;
  type: "builtin" | "skill";
}

export interface PromptSubmission {
  text: string;
  requestedSkillName: string | null;
}

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: "clear",
    description: "Clear the current conversation history",
    type: "builtin",
  },
  {
    name: "exit",
    description: "Exit the TUI session",
    type: "builtin",
  },
  {
    name: "help",
    description: "List available slash commands, or show details for one (`/help <name>`)",
    type: "builtin",
  },
  {
    name: "quit",
    description: "Exit the TUI session",
    type: "builtin",
  },
];

/** Parsed builtin invocation: command name plus any trailing argument string. */
export interface BuiltinInvocation {
  name: SlashCommand["name"];
  args: string;
}

export async function loadAvailableCommands(skillsDirs?: string[]): Promise<SlashCommand[]> {
  const skills = await listSkills(skillsDirs);
  const skillCommands = skills.map(toSkillCommand).sort((left, right) => left.name.localeCompare(right.name));
  return dedupeCommands([...BUILTIN_COMMANDS, ...skillCommands]);
}

export function filterCommands(commands: SlashCommand[], filter: string): SlashCommand[] {
  const normalizedFilter = normalizeCommandName(filter);
  if (!normalizedFilter) return commands;

  return commands
    .filter((command) => {
      const name = command.name.toLowerCase();
      const description = command.description.toLowerCase();
      return name.includes(normalizedFilter) || description.includes(normalizedFilter);
    })
    .sort((left, right) => scoreCommandMatch(right, normalizedFilter) - scoreCommandMatch(left, normalizedFilter));
}

export function getSlashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  if (/\s/.test(text)) return null;
  return text.slice(1);
}

export function insertSlashCommand(command: SlashCommand): string {
  return `/${command.name} `;
}

export function getHighlightedCommandName(text: string, commands: SlashCommand[]): string | null {
  const match = text.match(/^\/([^\s]+)\s/);
  if (!match) return null;
  const commandToken = match[1];
  if (!commandToken) return null;

  const commandName = normalizeCommandName(commandToken);
  return commands.some((command) => command.name.toLowerCase() === commandName) ? commandToken : null;
}

export function resolveBuiltinCommand(text: string): BuiltinInvocation | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^\/?([^\s]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const token = match[1];
  if (!token) return null;

  const normalized = normalizeCommandName(token);
  const builtin = BUILTIN_COMMANDS.find((command) => command.name === normalized);
  if (!builtin) return null;

  return { name: builtin.name, args: (match[2] ?? "").trim() };
}

/**
 * Renders a help string for slash commands. With no `target`, lists all
 * commands grouped by type. With a `target`, prints the matched command's
 * details, or an error message if not found.
 */
export function formatHelp(commands: SlashCommand[], target?: string): string {
  if (target) {
    const normalized = normalizeCommandName(target);
    const match = commands.find((c) => c.name.toLowerCase() === normalized);
    if (!match) {
      return `Unknown command: \`/${target}\`. Run \`/help\` to see available commands.`;
    }
    const kind = match.type === "builtin" ? "Built-in command" : "Skill";
    return `**/${match.name}** — _${kind}_\n\n${match.description}`;
  }

  const builtins = commands.filter((c) => c.type === "builtin");
  const skills = commands.filter((c) => c.type === "skill");

  const lines: string[] = ["**Available slash commands**", ""];

  if (builtins.length > 0) {
    lines.push("_Built-in_");
    for (const c of builtins) {
      lines.push(`- \`/${c.name}\` — ${c.description}`);
    }
  }

  if (skills.length > 0) {
    if (builtins.length > 0) lines.push("");
    lines.push("_Skills_");
    for (const c of skills) {
      lines.push(`- \`/${c.name}\` — ${c.description}`);
    }
  }

  lines.push("", "Run `/help <name>` for details on a single command.");
  return lines.join("\n");
}

export function buildPromptSubmission(text: string, commands: SlashCommand[]): PromptSubmission {
  const match = text.match(/^\/([^\s]+)(?:\s|$)/);
  if (!match) {
    return {
      text,
      requestedSkillName: null,
    };
  }
  const commandToken = match[1];
  if (!commandToken) {
    return {
      text,
      requestedSkillName: null,
    };
  }

  const requestedSkill = commands.find(
    (command) => command.type === "skill" && command.name.toLowerCase() === normalizeCommandName(commandToken),
  );

  return {
    text,
    requestedSkillName: requestedSkill?.name ?? null,
  };
}

function toSkillCommand(skill: SkillFrontmatter): SlashCommand {
  return {
    name: skill.name,
    description: skill.description,
    type: "skill",
  };
}

function dedupeCommands(commands: SlashCommand[]): SlashCommand[] {
  const seen = new Set<string>();
  const deduped: SlashCommand[] = [];

  for (const command of commands) {
    const key = command.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(command);
  }

  return deduped;
}

function normalizeCommandName(value: string): string {
  return value.replace(/^\//, "").trim().toLowerCase();
}

function scoreCommandMatch(command: SlashCommand, filter: string): number {
  const name = command.name.toLowerCase();
  const description = command.description.toLowerCase();

  if (name.startsWith(filter)) return 3;
  if (name.includes(filter)) return 2;
  if (description.includes(filter)) return 1;
  return 0;
}
