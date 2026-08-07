import { describe, expect, test } from "bun:test";

import { parseAssistantMessage } from "../utils";

describe("OpenAI non-stream tool argument compatibility", () => {
  test("keeps malformed JSON tool arguments inside the normal agent tool path", () => {
    const message = parseAssistantMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          type: "function",
          id: "call_1",
          function: { name: "read_file", arguments: '{"path":' },
        },
      ],
    } as never);

    expect(message.content).toContainEqual({
      type: "tool_use",
      id: "call_1",
      name: "read_file",
      input: {},
    });
  });

  test("normalizes non-object JSON tool arguments to an empty object", () => {
    const message = parseAssistantMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          type: "function",
          id: "call_2",
          function: { name: "read_file", arguments: '"not-an-object"' },
        },
      ],
    } as never);

    expect(message.content).toContainEqual({
      type: "tool_use",
      id: "call_2",
      name: "read_file",
      input: {},
    });
  });
});
