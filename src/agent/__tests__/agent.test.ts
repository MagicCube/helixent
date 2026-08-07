import { expect, test } from "bun:test";
import { z } from "zod";

import {
  defineTool,
  Model,
  type ModelProvider,
  type NonSystemMessage,
  type UserMessage,
} from "@/foundation";

import { Agent } from "../agent";

const provider: ModelProvider = {
  async invoke() {
    return { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
  async *stream() {
    yield { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
};

function userMessage(text: string): UserMessage {
  return { role: "user", content: [{ type: "text", text }] };
}

test("marks the agent as streaming before beforeAgentRun can await", async () => {
  let releaseBeforeRun!: () => void;
  let signalBeforeRunStarted!: () => void;
  const beforeRunStarted = new Promise<void>((resolve) => {
    signalBeforeRunStarted = resolve;
  });
  const beforeRunGate = new Promise<void>((resolve) => {
    releaseBeforeRun = resolve;
  });

  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    middlewares: [
      {
        beforeAgentRun: async () => {
          signalBeforeRunStarted();
          await beforeRunGate;
        },
      },
    ],
  });

  const stream = agent.stream(userMessage("first"));
  const firstRead = stream.next();
  await beforeRunStarted;

  expect(agent.streaming).toBe(true);

  const concurrent = agent.stream(userMessage("second"));
  await expect(concurrent.next()).rejects.toThrow("Agent is already streaming");

  releaseBeforeRun();
  await firstRead;
  while (!(await stream.next()).done) {
    // Drain the stream so the generator reaches its cleanup path.
  }

  expect(agent.streaming).toBe(false);
});

test("clears streaming state when transcript setup throws", async () => {
  const frozenMessages = Object.freeze([]) as unknown as NonSystemMessage[];
  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    messages: frozenMessages,
  });

  const stream = agent.stream(userMessage("cannot append"));
  await expect(stream.next()).rejects.toThrow();
  expect(agent.streaming).toBe(false);
});

test("does not invoke a tool after abort while beforeToolUse is awaiting", async () => {
  let approvalStarted!: () => void;
  let releaseApproval!: () => void;
  const approvalStartedPromise = new Promise<void>((resolve) => {
    approvalStarted = resolve;
  });
  const approvalGate = new Promise<void>((resolve) => {
    releaseApproval = resolve;
  });
  let invoked = false;

  const tool = defineTool({
    name: "delayed_tool",
    description: "test tool",
    parameters: z.object({}),
    invoke: async () => {
      invoked = true;
      return "ran";
    },
  });

  const toolProvider: ModelProvider = {
    async invoke() {
      return {
        role: "assistant",
        content: [{ type: "tool_use", id: "tc_1", name: "delayed_tool", input: {} }],
      };
    },
    async *stream() {
      yield {
        role: "assistant",
        content: [{ type: "tool_use", id: "tc_1", name: "delayed_tool", input: {} }],
      };
    },
  };

  const agent = new Agent({
    model: new Model("test-model", toolProvider),
    prompt: "test",
    tools: [tool],
    middlewares: [
      {
        beforeToolUse: async () => {
          approvalStarted();
          await approvalGate;
        },
      },
    ],
  });

  const stream = agent.stream(userMessage("run tool"));
  const assistantEvent = await stream.next();
  expect(assistantEvent.done).toBe(false);

  const pendingToolEvent = stream.next();
  await approvalStartedPromise;
  agent.abort();
  await expect(pendingToolEvent).rejects.toThrow();

  releaseApproval();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(invoked).toBe(false);
  expect(agent.streaming).toBe(false);
});
