import { expect, test } from "bun:test";

import { Agent } from "../agent";
import { Model, type ModelProvider, type NonSystemMessage } from "@/foundation";

const provider: ModelProvider = {
  async invoke() {
    return { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
  async *stream() {
    yield { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
};

test("reset restores constructor messages and calls middleware reset hooks", async () => {
  const initialMessage: NonSystemMessage = {
    role: "user",
    content: [{ type: "text", text: "AGENTS.md instructions" }],
  };
  const messages: NonSystemMessage[] = [initialMessage];
  let resetCalls = 0;
  let requestedSkillAtReset: string | null | undefined = "not-observed";

  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    messages,
    middlewares: [
      {
        onReset: ({ agentContext }) => {
          resetCalls += 1;
          requestedSkillAtReset = agentContext.requestedSkillName;
        },
      },
    ],
  });

  agent.messages.push({ role: "assistant", content: [{ type: "text", text: "runtime reply" }] });
  agent.setRequestedSkillName("temporary-skill");

  await agent.reset();

  expect(resetCalls).toBe(1);
  expect(requestedSkillAtReset).toBeNull();
  expect(agent.messages).toEqual([initialMessage]);
  expect(messages).toEqual([initialMessage]);
});

test("reset is rejected while beforeAgentRun is still awaiting", async () => {
  let signalStarted!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    middlewares: [
      {
        beforeAgentRun: async () => {
          signalStarted();
          await gate;
        },
      },
    ],
  });

  const stream = agent.stream({ role: "user", content: [{ type: "text", text: "hello" }] });
  const firstRead = stream.next();
  await started;

  // `_streaming` is still false in the main-branch startup sequence, but an
  // abort controller already marks the run as active.
  expect(agent.streaming).toBe(false);
  await expect(agent.reset()).rejects.toThrow("Cannot reset Agent while a run is active");

  release();
  await firstRead;
  while (!(await stream.next()).done) {
    // Drain to complete normal cleanup.
  }
});
