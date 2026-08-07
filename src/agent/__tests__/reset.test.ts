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
