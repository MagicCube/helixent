import { expect, test } from "bun:test";

import { Model, type ModelProvider, type NonSystemMessage, type UserMessage } from "@/foundation";

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
