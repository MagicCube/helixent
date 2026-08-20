import { expect, test } from "bun:test";

import { Model, type ModelProvider, type UserMessage } from "@/foundation";

import { Agent } from "../agent";
import type { AgentMiddleware } from "../agent-middleware";

const provider: ModelProvider = {
  async invoke() {
    return { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
  async *stream() {
    yield { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
};

test("runs afterAgentStep before afterAgentRun for a final step without tools", async () => {
  const lifecycle: string[] = [];
  const middleware: AgentMiddleware = {
    afterAgentStep: async ({ step }) => {
      lifecycle.push(`afterAgentStep:${step}`);
    },
    afterAgentRun: async () => {
      lifecycle.push("afterAgentRun");
    },
  };
  const agent = new Agent({
    model: new Model("test-model", provider),
    prompt: "test",
    middlewares: [middleware],
  });
  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: "hello" }],
  };

  const stream = agent.stream(userMessage);
  while (!(await stream.next()).done) {
    // Drain the stream so the generator reaches the final lifecycle hooks.
  }

  expect(lifecycle).toEqual(["afterAgentStep:1", "afterAgentRun"]);
});
