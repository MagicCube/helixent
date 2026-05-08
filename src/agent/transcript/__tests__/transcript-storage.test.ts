import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { sanitizeCwd, getProjectDir, appendEntry, loadTranscript } from "../transcript-storage";

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
