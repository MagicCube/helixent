import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { AgentContext } from "@/agent";
import type { ToolUseContent } from "@/foundation";

import type { ApprovalDecision } from "../approval-types";
import { createCodingApprovalMiddleware } from "../coding-approval-middleware";

function makeToolUse(name: string, input: Record<string, unknown> = {}): ToolUseContent {
  return { type: "tool_use", id: "tc_1", name, input };
}

const mockAgentContext: AgentContext = { prompt: "", messages: [], tools: [] };
let tempRoot: string;
let projectDir: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "helixent-approval-"));
  projectDir = join(tempRoot, "project");
  await mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("createCodingApprovalMiddleware", () => {
  test("allows non-risky file tools when their path stays inside the project", async () => {
    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash", "write_file"],
      askUser: async () => {
        asked = true;
        return "deny" as ApprovalDecision;
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("read_file", { path: join(projectDir, "src", "index.ts") }),
    });

    expect(asked).toBe(false);
    expect(result).toBeUndefined();
  });

  test("allows read-only access under trusted skill roots outside the project", async () => {
    const skillRoot = join(tempRoot, "user-skills");
    await mkdir(join(skillRoot, "example"), { recursive: true });

    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      trustedReadRoots: [skillRoot],
      requiresApproval: [],
      askUser: async () => {
        asked = true;
        return "deny" as ApprovalDecision;
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("read_file", { path: join(skillRoot, "example", "SKILL.md") }),
    });

    expect(asked).toBe(false);
    expect(result).toBeUndefined();
  });

  test("trusted read roots do not exempt writes", async () => {
    const skillRoot = join(tempRoot, "user-skills");
    await mkdir(skillRoot, { recursive: true });

    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      trustedReadRoots: [skillRoot],
      requiresApproval: ["write_file"],
      askUser: async () => {
        asked = true;
        return "allow_once" as ApprovalDecision;
      },
      approvalPersistence: {
        loadAllowList: async () => new Set(["write_file"]),
        persistAllowedTool: async () => {},
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("write_file", { path: join(skillRoot, "modified.md"), content: "x" }),
    });

    expect(asked).toBe(true);
    expect(result).toBeUndefined();
  });

  test("asks before a read_file call can leave the project", async () => {
    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash", "write_file"],
      askUser: async () => {
        asked = true;
        return "deny" as ApprovalDecision;
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("read_file", { path: join(tempRoot, "secret.txt") }),
    });

    expect(asked).toBe(true);
    expect(result).toMatchObject({ __skip: true });
  });

  test("project allow does not bypass approval for an outside write path", async () => {
    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["write_file"],
      askUser: async () => {
        asked = true;
        return "allow_once" as ApprovalDecision;
      },
      approvalPersistence: {
        loadAllowList: async () => new Set(["write_file"]),
        persistAllowedTool: async () => {},
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("write_file", { path: join(tempRoot, "outside.txt"), content: "x" }),
    });

    expect(asked).toBe(true);
    expect(result).toBeUndefined();
  });

  test.skipIf(process.platform === "win32")("resolves symlinks before deciding a path is inside the project", async () => {
    const outsideDir = join(tempRoot, "outside");
    await mkdir(outsideDir, { recursive: true });
    await symlink(outsideDir, join(projectDir, "linked-outside"));

    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: [],
      askUser: async () => {
        asked = true;
        return "deny" as ApprovalDecision;
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("read_file", { path: join(projectDir, "linked-outside", "secret.txt") }),
    });

    expect(asked).toBe(true);
    expect(result).toMatchObject({ __skip: true });
  });

  test("checks apply_patch target paths even when the tool is project-allowed", async () => {
    let asked = false;
    const outsidePath = join(tempRoot, "outside.txt");
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["apply_patch"],
      askUser: async () => {
        asked = true;
        return "allow_once" as ApprovalDecision;
      },
      approvalPersistence: {
        loadAllowList: async () => new Set(["apply_patch"]),
        persistAllowedTool: async () => {},
      },
    });

    const patch = [`--- ${outsidePath}`, `+++ ${outsidePath}`, "@@ -0,0 +1,1 @@", "+secret", ""].join("\n");
    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("apply_patch", { patch }),
    });

    expect(asked).toBe(true);
    expect(result).toBeUndefined();
  });

  test("asks user for tools in the requiresApproval list", async () => {
    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash"],
      askUser: async () => {
        asked = true;
        return "allow_once" as ApprovalDecision;
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("bash"),
    });

    expect(asked).toBe(true);
    expect(result).toBeUndefined();
  });

  test("skips approval when tool is in the allow list and stays within project scope", async () => {
    let asked = false;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["write_file"],
      askUser: async () => {
        asked = true;
        return "allow_once" as ApprovalDecision;
      },
      approvalPersistence: {
        loadAllowList: async () => new Set(["write_file"]),
        persistAllowedTool: async () => {},
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("write_file", { path: join(projectDir, "safe.txt"), content: "ok" }),
    });

    expect(asked).toBe(false);
    expect(result).toBeUndefined();
  });

  test("returns skip result when user denies", async () => {
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash"],
      askUser: async () => "deny" as ApprovalDecision,
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("bash"),
    });

    expect(result).toMatchObject({
      __skip: true,
      result: expect.stringContaining("User denied execution of tool: bash"),
    });
  });

  test("persists tool when user allows always for project", async () => {
    let persistedTool: string | undefined;
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash"],
      askUser: async () => "allow_always_project" as ApprovalDecision,
      approvalPersistence: {
        loadAllowList: async () => new Set(),
        persistAllowedTool: async (_cwd, toolName) => {
          persistedTool = toolName;
        },
      },
    });

    await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("bash"),
    });

    expect(persistedTool).toBe("bash");
  });

  test("does not throw when persistence fails on allow_always_project", async () => {
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash"],
      askUser: async () => "allow_always_project" as ApprovalDecision,
      approvalPersistence: {
        loadAllowList: async () => new Set(),
        persistAllowedTool: async () => {
          throw new Error("disk full");
        },
      },
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("bash"),
    });

    expect(result).toBeUndefined();
  });

  test("works without approvalPersistence", async () => {
    const middleware = createCodingApprovalMiddleware({
      cwd: projectDir,
      requiresApproval: ["bash"],
      askUser: async () => "allow_always_project" as ApprovalDecision,
    });

    const result = await middleware.beforeToolUse?.({
      agentContext: mockAgentContext,
      toolUse: makeToolUse("bash"),
    });

    expect(result).toBeUndefined();
  });
});
