import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

import type { NonSystemMessage } from "@/foundation";

/**
 * Replace path separators and colons with dashes for safe directory names.
 */
export function sanitizeCwd(cwd: string): string {
  return cwd.replace(/[/\\:]+/g, "-");
}

/**
 * Get the project-specific transcript directory.
 */
export function getProjectDir(cwd: string): string {
  return join(homedir(), ".helixent", "projects", sanitizeCwd(cwd));
}

/**
 * Get the path to the most recent session file for a project directory.
 * Returns null if no sessions exist.
 */
export function getLatestSessionPath(cwd: string): string | null {
  const projectDir = getProjectDir(cwd);
  if (!existsSync(projectDir)) return null;

  const files = readdirSync(projectDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ name: f, mtime: statSync(join(projectDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? join(projectDir, files[0]!.name) : null;
}

/**
 * Append a message entry to the transcript file.
 */
export function appendEntry(filePath: string, message: NonSystemMessage): void {
  const entry = {
    type: message.role,
    timestamp: new Date().toISOString(),
    message,
  };
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  appendFileSync(filePath, JSON.stringify(entry) + "\n", { mode: 0o600 });
}

/**
 * Load all messages from a transcript file.
 */
export function loadTranscript(filePath: string): NonSystemMessage[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).message as NonSystemMessage);
}
