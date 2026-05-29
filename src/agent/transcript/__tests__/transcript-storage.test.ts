import { mkdtempSync, rmSync, readFileSync, utimesSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it, beforeEach, afterEach } from "bun:test";

import { sanitizeCwd, getProjectDir, appendEntry, loadTranscript, listSessions } from "../transcript-storage";

describe("sanitizeCwd", () => {
  it("replaces path separators and colons with dashes", () => {
    expect(sanitizeCwd("E:\\Github\\helixent")).toBe("E-Github-helixent");
    expect(sanitizeCwd("/home/user/project")).toBe("-home-user-project");
  });
});

describe("getProjectDir", () => {
  it("returns path under ~/.helixent/projects/ with sanitized cwd", () => {
    const dir = getProjectDir("/home/user/myproject");
    expect(dir).toContain(".helixent");
    expect(dir).toContain("projects");
    expect(dir).toContain("-home-user-myproject");
  });
});

describe("appendEntry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "transcript-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("appends a JSONL line to the file", () => {
    const filePath = join(tmpDir, "test.jsonl");
    const message = { role: "user" as const, content: [{ type: "text" as const, text: "hello" }] };
    appendEntry(filePath, message);

    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.type).toBe("user");
    expect(parsed.message).toEqual(message);
    expect(parsed.timestamp).toBeDefined();
  });

  it("appends multiple entries on separate lines", () => {
    const filePath = join(tmpDir, "test.jsonl");
    const msg1 = { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] };
    const msg2 = { role: "assistant" as const, content: [{ type: "text" as const, text: "hello" }] };
    appendEntry(filePath, msg1);
    appendEntry(filePath, msg2);

    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});

describe("loadTranscript", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "transcript-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("reads JSONL and returns messages array", () => {
    const filePath = join(tmpDir, "session.jsonl");
    const msg = { role: "user" as const, content: [{ type: "text" as const, text: "test" }] };
    appendEntry(filePath, msg);

    const messages = loadTranscript(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe("user");
  });

  it("returns empty array for non-existent file", () => {
    const messages = loadTranscript(join(tmpDir, "nope.jsonl"));
    expect(messages).toHaveLength(0);
  });
});

describe("listSessions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "transcript-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("returns empty array when no sessions exist", () => {
    const sessions = listSessions(tmpDir);
    expect(sessions).toHaveLength(0);
  });

  it("returns sessions sorted by mtime descending", () => {
    const msg = { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] };
    const path1 = join(tmpDir, "aaa-111.jsonl");
    const path2 = join(tmpDir, "bbb-222.jsonl");
    appendEntry(path1, msg);
    appendEntry(path1, msg);
    appendEntry(path2, msg);
    // Force different mtimes
    const older = new Date(Date.now() - 10000);
    const newer = new Date(Date.now());
    utimesSync(path1, older, older);
    utimesSync(path2, newer, newer);

    const sessions = listSessions(tmpDir);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0]!.id).toBe("bbb-222");
    expect(sessions[0]!.messageCount).toBe(1);
    expect(sessions[1]!.id).toBe("aaa-111");
    expect(sessions[1]!.messageCount).toBe(2);
  });

  it("respects limit parameter", () => {
    const msg = { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] };
    appendEntry(join(tmpDir, "a.jsonl"), msg);
    appendEntry(join(tmpDir, "b.jsonl"), msg);
    appendEntry(join(tmpDir, "c.jsonl"), msg);

    const sessions = listSessions(tmpDir, 2);
    expect(sessions).toHaveLength(2);
  });

  it("returns empty array for non-existent directory", () => {
    const sessions = listSessions(join(tmpDir, "nonexistent"));
    expect(sessions).toHaveLength(0);
  });
});
