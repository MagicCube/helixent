import type { AssistantMessage, NonSystemMessage, ToolUseContent, UserMessage } from "@/foundation";

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const WHITE = `${ESC}37m`;
const GRAY = `${ESC}90m`;

const white = (s: string) => `${WHITE}${s}${RESET}`;
const bold = (s: string) => `${BOLD}${s}${RESET}`;
const dim = (s: string) => `${DIM}${GRAY}${s}${RESET}`;

export function messageToPlainText(message: NonSystemMessage): string | null {
  switch (message.role) {
    case "user":
      return userMessageText(message);
    case "assistant":
      return assistantMessageText(message);
    case "tool":
      return null;
    default:
      return null;
  }
}

function userMessageText(message: UserMessage): string {
  const text = message.content.map((c) => (c.type === "text" ? c.text : "[image]")).join("\n");
  return `${bold(white("❯"))} ${white(text)}`;
}

function assistantMessageText(message: AssistantMessage): string {
  const parts: string[] = [];
  for (const content of message.content) {
    switch (content.type) {
      case "text":
        if (content.text) {
          parts.push(`${white("⏺")} ${content.text}`);
        }
        break;
      case "tool_use":
        parts.push(toolUseText(content));
        break;
    }
  }
  return parts.join("\n");
}

function toolUseText(content: ToolUseContent): string {
  switch (content.name) {
    case "bash":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ ${content.input.command as string}`)}`;
    case "str_replace":
    case "read_file":
    case "write_file":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ ${content.input.path as string}`)}`;
    case "todo_write":
      return `${dim("⏺")} Working on todos`;
    case "ask_user_question": {
      const qs = (content.input as { questions?: { header?: string }[] }).questions;
      const n = qs?.length ?? 0;
      const first = qs?.[0]?.header;
      return `${dim("⏺")} Ask user${n ? `: ${n} question(s)` : ""}${first ? dim(`\n  └─ ${first}`) : ""}`;
    }
    case "list_files":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ ${content.input.path as string}`)}`;
    case "glob_search":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ ${content.input.path as string} :: ${content.input.pattern as string}`)}`;
    case "grep_search":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ ${content.input.path as string} :: ${content.input.pattern as string}`)}`;
    case "apply_patch":
      return `${dim("⏺")} ${content.input.description as string}\n  ${dim(`└─ unified diff patch`)}`;
    default:
      return `${dim("⏺")} Tool call\n  ${dim(`└─ ${content.name}`)}`;
  }
}
