import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { NonSystemMessage } from "@/foundation";

import { generateSessionId, listSessions, loadSession, saveSession, type Session } from "./session-store";

let tmpHome: string;
let originalHome: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(tmpdir(), "helixent-session-test-"));
  originalHome = Bun.env.HELIXENT_HOME;
  Bun.env.HELIXENT_HOME = tmpHome;
});

afterEach(() => {
  if (originalHome === undefined) delete Bun.env.HELIXENT_HOME;
  else Bun.env.HELIXENT_HOME = originalHome;
  rmSync(tmpHome, { recursive: true, force: true });
});

const sampleMessages: NonSystemMessage[] = [
  { role: "user", content: [{ type: "text", text: "hello" }] },
  { role: "assistant", content: [{ type: "text", text: "hi there" }] },
];

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "abcd1234",
    createdAt: "2026-04-17T00:00:00.000Z",
    updatedAt: "2026-04-17T00:00:01.000Z",
    cwd: "/tmp/project",
    messages: sampleMessages,
    ...overrides,
  };
}

describe("session-store", () => {
  test("save → load round-trip preserves all fields", () => {
    const original = makeSession();
    saveSession(original);
    const loaded = loadSession(original.id);
    expect(loaded).toEqual(original);
  });

  test("loadSession returns null for missing id", () => {
    expect(loadSession("does-not-exist")).toBeNull();
  });

  test("loadSession returns null for corrupt JSON (does not throw)", () => {
    const dir = path.join(tmpHome, "sessions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "broken.json"), "{ not valid json", "utf8");
    expect(loadSession("broken")).toBeNull();
  });

  test("listSessions returns sessions sorted by updatedAt desc", () => {
    saveSession(makeSession({ id: "old00000", updatedAt: "2026-04-01T00:00:00.000Z" }));
    saveSession(makeSession({ id: "mid00000", updatedAt: "2026-04-10T00:00:00.000Z" }));
    saveSession(makeSession({ id: "new00000", updatedAt: "2026-04-15T00:00:00.000Z" }));
    const ids = listSessions().map((s) => s.id);
    expect(ids).toEqual(["new00000", "mid00000", "old00000"]);
  });

  test("listSessions skips corrupt files without throwing", () => {
    saveSession(makeSession({ id: "good0001" }));
    const dir = path.join(tmpHome, "sessions");
    writeFileSync(path.join(dir, "corrupt.json"), "{ bad", "utf8");
    const ids = listSessions().map((s) => s.id);
    expect(ids).toEqual(["good0001"]);
  });

  test("listSessions returns [] when no sessions dir exists", () => {
    expect(listSessions()).toEqual([]);
  });

  test("saveSession overwrites existing session with same id", () => {
    saveSession(makeSession({ id: "same0000", updatedAt: "2026-04-01T00:00:00.000Z" }));
    saveSession(
      makeSession({
        id: "same0000",
        updatedAt: "2026-04-02T00:00:00.000Z",
        messages: [{ role: "user", content: [{ type: "text", text: "updated" }] }],
      }),
    );
    const loaded = loadSession("same0000");
    expect(loaded?.updatedAt).toBe("2026-04-02T00:00:00.000Z");
    expect(loaded?.messages).toHaveLength(1);
  });

  test("generateSessionId returns 8-character string", () => {
    const id = generateSessionId();
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  test("generateSessionId returns unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
    expect(ids.size).toBe(100);
  });
});
