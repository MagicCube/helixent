import { describe, expect, test } from "bun:test";

import type { ToolUseContent } from "@/foundation";

import { ApprovalManager } from "../approval-manager";
import type { ApprovalDecision } from "../approval-types";

function makeToolUse(name: string): ToolUseContent {
  return { type: "tool_use", id: "tc_1", name, input: {} };
}

describe("ApprovalManager", () => {
  test("askUser queues a request and subscriber receives it", async () => {
    const manager = new ApprovalManager();
    const toolUse = makeToolUse("bash");

    const received: ToolUseContent[] = [];
    manager.subscribe((req) => {
      if (req) received.push(req.toolUse);
    });

    const promise = manager.askUser(toolUse);
    expect(received).toHaveLength(1);
    expect(received[0]!.name).toBe("bash");

    manager.respond("allow_once");
    const decision = await promise;
    expect(decision).toBe("allow_once");
  });

  test("respond resolves the pending request with the decision", async () => {
    const manager = new ApprovalManager();
    const toolUse = makeToolUse("write_file");

    const promise = manager.askUser(toolUse);
    manager.respond("deny");

    const decision = await promise;
    expect(decision).toBe("deny");
  });

  test("respond does nothing when no request is pending", () => {
    const manager = new ApprovalManager();
    expect(() => manager.respond("allow_once")).not.toThrow();
  });

  test("processes queued requests sequentially", async () => {
    const manager = new ApprovalManager();
    const decisions: ApprovalDecision[] = [];

    const p1 = manager.askUser(makeToolUse("bash"));
    const p2 = manager.askUser(makeToolUse("write_file"));

    manager.respond("allow_once");
    decisions.push(await p1);

    manager.respond("deny");
    decisions.push(await p2);

    expect(decisions).toEqual(["allow_once", "deny"]);
  });

  test("subscriber receives null when queue empties", async () => {
    const manager = new ApprovalManager();
    const events: (ToolUseContent | null)[] = [];

    manager.subscribe((req) => {
      events.push(req?.toolUse ?? null);
    });

    const promise = manager.askUser(makeToolUse("bash"));
    manager.respond("allow_once");
    await promise;

    expect(events).toContain(null);
  });

  test("aborting the current request rejects it and clears subscriber state", async () => {
    const manager = new ApprovalManager();
    const events: Array<string | null> = [];
    manager.subscribe((req) => {
      events.push(req?.toolUse.name ?? null);
    });

    const controller = new AbortController();
    const pending = manager.askUser(makeToolUse("bash"), controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(events.at(-1)).toBeNull();
  });

  test("aborting a queued request removes it before it can become current", async () => {
    const manager = new ApprovalManager();
    const events: Array<string | null> = [];
    manager.subscribe((req) => {
      events.push(req?.toolUse.name ?? null);
    });

    const first = manager.askUser(makeToolUse("bash"));
    const controller = new AbortController();
    const second = manager.askUser(makeToolUse("write_file"), controller.signal);
    controller.abort();

    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    manager.respond("allow_once");
    await first;

    expect(events).not.toContain("write_file");
    expect(events.at(-1)).toBeNull();
  });

  test("aborting one run signal never publishes another queued request from that run", async () => {
    const manager = new ApprovalManager();
    const events: Array<string | null> = [];
    manager.subscribe((req) => {
      events.push(req?.toolUse.name ?? null);
    });

    const controller = new AbortController();
    const first = manager.askUser(makeToolUse("bash"), controller.signal);
    const second = manager.askUser(makeToolUse("write_file"), controller.signal);
    const third = manager.askUser(makeToolUse("apply_patch"), controller.signal);

    expect(events.at(-1)).toBe("bash");
    controller.abort();

    await Promise.all([
      expect(first).rejects.toMatchObject({ name: "AbortError" }),
      expect(second).rejects.toMatchObject({ name: "AbortError" }),
      expect(third).rejects.toMatchObject({ name: "AbortError" }),
    ]);

    expect(events).not.toContain("write_file");
    expect(events).not.toContain("apply_patch");
    expect(events.at(-1)).toBeNull();
  });

  test("subscribe returns unsubscribe function", async () => {
    const manager = new ApprovalManager();
    const events: (ToolUseContent | null)[] = [];

    const unsubscribe = manager.subscribe((req) => {
      events.push(req?.toolUse ?? null);
    });

    const promise = manager.askUser(makeToolUse("bash"));
    manager.respond("allow_once");
    await promise;

    expect(events.length).toBeGreaterThan(0);
    const countBefore = events.length;

    unsubscribe();
    const promise2 = manager.askUser(makeToolUse("write_file"));
    manager.respond("deny");
    await promise2;

    expect(events.length).toBe(countBefore);
  });
});
