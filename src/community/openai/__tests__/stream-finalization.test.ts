import { describe, expect, test } from "bun:test";

import { OpenAIModelProvider } from "../model-provider";
import { StreamAccumulator } from "../stream-utils";

describe("OpenAI stream finalization", () => {
  test("StreamAccumulator can finalize independently of usage metadata", () => {
    const acc = new StreamAccumulator();
    acc.push({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "compatible-model",
      choices: [{ index: 0, delta: { content: "done" }, finish_reason: "stop" }],
    });

    expect(acc.snapshot().streaming).toBe(true);
    expect(acc.finish()).toBe(true);

    const finalSnapshot = acc.snapshot();
    expect(finalSnapshot.streaming).toBeUndefined();
    expect(finalSnapshot.usage).toBeUndefined();
    expect(finalSnapshot.content).toEqual([{ type: "text", text: "done" }]);
  });

  test("provider emits a final non-streaming snapshot when a compatible endpoint omits usage", async () => {
    const provider = new OpenAIModelProvider({ apiKey: "test-key" });
    const response = (async function* () {
      yield {
        id: "chatcmpl-1",
        object: "chat.completion.chunk",
        created: 0,
        model: "compatible-model",
        choices: [{ index: 0, delta: { content: "hello" }, finish_reason: null }],
      };
      yield {
        id: "chatcmpl-1",
        object: "chat.completion.chunk",
        created: 0,
        model: "compatible-model",
        choices: [{ index: 0, delta: { content: " world" }, finish_reason: "stop" }],
      };
    })();

    provider._client = {
      chat: {
        completions: {
          create: async () => response,
        },
      },
    } as never;

    const snapshots = [];
    for await (const snapshot of provider.stream({ model: "compatible-model", messages: [] })) {
      snapshots.push(snapshot);
    }

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]?.streaming).toBe(true);
    expect(snapshots[1]?.streaming).toBe(true);
    expect(snapshots[2]?.streaming).toBeUndefined();
    expect(snapshots[2]?.usage).toBeUndefined();
    expect(snapshots[2]?.content).toEqual([{ type: "text", text: "hello world" }]);
  });

  test("provider does not synthesize an empty assistant message for an empty iterator", async () => {
    const provider = new OpenAIModelProvider({ apiKey: "test-key" });
    const response = (async function* () {
      // Intentionally empty.
    })();

    provider._client = {
      chat: {
        completions: {
          create: async () => response,
        },
      },
    } as never;

    const snapshots = [];
    for await (const snapshot of provider.stream({ model: "compatible-model", messages: [] })) {
      snapshots.push(snapshot);
    }

    expect(snapshots).toEqual([]);
  });
});
