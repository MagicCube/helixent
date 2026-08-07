import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { defineTool } from "../function-tool";

describe("defineTool runtime validation", () => {
  test("rejects malformed model input before invoking the implementation", async () => {
    let invoked = false;
    const tool = defineTool({
      name: "example",
      description: "example tool",
      parameters: z.object({ path: z.string().min(1) }),
      invoke: async ({ path }) => {
        invoked = true;
        return path;
      },
    });

    await expect(tool.invoke({} as never)).rejects.toMatchObject({ name: "ZodError" });
    expect(invoked).toBe(false);
  });

  test("passes schema-transformed input to the implementation", async () => {
    let received = "";
    const tool = defineTool({
      name: "trimmed",
      description: "trim input",
      parameters: z.object({ value: z.string().trim() }),
      invoke: async ({ value }) => {
        received = value;
        return value;
      },
    });

    await expect(tool.invoke({ value: "  clean  " })).resolves.toBe("clean");
    expect(received).toBe("clean");
  });

  test("forwards the active AbortSignal after validation", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const tool = defineTool({
      name: "signal",
      description: "signal tool",
      parameters: z.object({}),
      invoke: async (_input, signal) => {
        receivedSignal = signal;
        return "ok";
      },
    });

    await tool.invoke({}, controller.signal);
    expect(receivedSignal).toBe(controller.signal);
  });
});
