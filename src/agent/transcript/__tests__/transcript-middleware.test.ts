import { mkdtempSync, rmSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it, beforeEach, afterEach } from "bun:test";

import { createTranscriptMiddleware } from "../transcript-middleware";

describe("createTranscriptMiddleware", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "transcript-mw-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("writes existing messages on beforeAgentRun", async () => {
    const mw = createTranscriptMiddleware({ cwd: tmpDir, projectDir: tmpDir });
    const agentContext = {
      prompt: "test",
      messages: [{ role: "user" as const, content: [{ type: "text" as const, text: "hello" }] }],
    };

    await mw.beforeAgentRun!({ agentContext: agentContext as any });

    const files = readdirSync(tmpDir).filter((f: string) => f.endsWith(".jsonl"));
    expect(files).toHaveLength(1);

    const content = readFileSync(join(tmpDir, files[0]!), "utf-8").trim();
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe("user");
  });

  it("incrementally writes new messages on afterAgentStep", async () => {
    const mw = createTranscriptMiddleware({ cwd: tmpDir, projectDir: tmpDir });
    const agentContext = {
      prompt: "test",
      messages: [
        { role: "user", content: [{ type: "text", text: "hello" }] },
      ] as Array<{ role: "user" | "assistant"; content: Array<{ type: "text"; text: string }> }>,
    };

    await mw.beforeAgentRun!({ agentContext: agentContext as any });

    agentContext.messages.push({ role: "assistant", content: [{ type: "text", text: "hi" }] });
    await mw.afterAgentStep!({ agentContext: agentContext as any, step: 1 });

    const files = readdirSync(tmpDir).filter((f: string) => f.endsWith(".jsonl"));
    const lines = readFileSync(join(tmpDir, files[0]!), "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
