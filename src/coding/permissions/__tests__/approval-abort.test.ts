import { expect, test } from "bun:test";
import { z } from "zod";

import { Agent } from "@/agent";
import { defineTool, Model, type ModelProvider } from "@/foundation";

import { ApprovalManager } from "../approval-manager";
import { createCodingApprovalMiddleware } from "../coding-approval-middleware";

const provider: ModelProvider = {
  async invoke() {
    return {
      role: "assistant",
      content: [{ type: "tool_use", id: "tc_1", name: "dangerous", input: {} }],
    };
  },
  async *stream() {
    yield {
      role: "assistant",
      content: [{ type: "tool_use", id: "tc_1", name: "dangerous", input: {} }],
    };
  },
};

test("agent abort cancels the displayed approval and prevents tool execution", async () => {
  const manager = new ApprovalManager();
  const approvalStates: Array<"request" | "empty"> = [];
  manager.subscribe((request) => {
    approvalStates.push(request ? "request" : "empty");
  });

  let invoked = false;
  const tool = defineTool({
    name: "dangerous",
    description: "test tool",
    parameters: z.object({}),
    invoke: async () => {
      invoked = true;
      return "ran";
    },
  });

  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    tools: [tool],
    middlewares: [
      createCodingApprovalMiddleware({
        cwd: process.cwd(),
        requiresApproval: ["dangerous"],
        askUser: manager.askUser,
      }),
    ],
  });

  const stream = agent.stream({ role: "user", content: [{ type: "text", text: "run it" }] });
  const assistantEvent = await stream.next();
  expect(assistantEvent.done).toBe(false);

  const pendingToolEvent = stream.next();
  await Promise.resolve();
  expect(approvalStates.at(-1)).toBe("request");

  agent.abort();
  await expect(pendingToolEvent).rejects.toThrow();

  expect(approvalStates.at(-1)).toBe("empty");
  expect(invoked).toBe(false);
});
