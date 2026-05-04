import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getHelixentHomePath } from "@/cli/config";
import type { NonSystemMessage } from "@/foundation";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  /** All conversation messages visible in the TUI (excludes the AGENTS.md preamble). */
  messages: NonSystemMessage[];
}

function getSessionsDir(): string {
  return path.join(getHelixentHomePath(), "sessions");
}

function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`);
}

export function generateSessionId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function saveSession(session: Session): void {
  const dir = getSessionsDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSessionFilePath(session.id), JSON.stringify(session), "utf8");
}

export function loadSession(sessionId: string): Session | null {
  const filePath = getSessionFilePath(sessionId);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Session;
  } catch {
    return null;
  }
}

export function listSessions(): Session[] {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return [];
  const sessions: Session[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      sessions.push(JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Session);
    } catch {
      // skip corrupt files
    }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
