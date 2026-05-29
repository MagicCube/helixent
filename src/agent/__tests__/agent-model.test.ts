import { describe, expect, it } from "bun:test";

import type { AssistantMessage, ModelProvider, ModelProviderInvokeParams, UserMessage } from "@/foundation";
import { Model } from "@/foundation";

import { Agent } from "../agent";

class EchoModelProvider implements ModelProvider {
  async invoke(params: ModelProviderInvokeParams): Promise<AssistantMessage> {
    return modelMessage(params.model);
  }

  async *stream(params: ModelProviderInvokeParams): AsyncGenerator<AssistantMessage> {
    yield modelMessage(params.model);
  }
}

describe("Agent model switching", () => {
  it("uses the new model for future steps without clearing messages", async () => {
    const agent = new Agent({
      model: new Model("first-model", new EchoModelProvider()),
      prompt: "test",
    });

    const first = await runOnce(agent, "hello");
    expect(first).toBe("first-model");
    expect(agent.messages).toHaveLength(2);

    agent.setModel(new Model("second-model", new EchoModelProvider()));
    expect(agent.model.name).toBe("second-model");
    expect(agent.messages).toHaveLength(2);

    const second = await runOnce(agent, "again");
    expect(second).toBe("second-model");
    expect(agent.messages).toHaveLength(4);
  });
});

async function runOnce(agent: Agent, text: string): Promise<string> {
  const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
  let finalText = "";
  for await (const event of agent.stream(userMessage)) {
    if (event.type !== "message" || event.message.role !== "assistant") continue;
    const content = event.message.content.find((item) => item.type === "text");
    finalText = content?.text ?? "";
  }
  return finalText;
}

function modelMessage(modelName: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: modelName }],
  };
}
