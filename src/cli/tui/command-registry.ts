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
    name: "quit",
    description: "Exit the TUI session",
    type: "builtin",
  },
];

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

export function resolveBuiltinCommand(text: string): SlashCommand["name"] | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const normalized = normalizeCommandName(trimmed);
  return BUILTIN_COMMANDS.find((command) => command.name === normalized)?.name ?? null;
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
