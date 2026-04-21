import { describe, expect, test } from "bun:test";

import { ApprovalManager } from "../approval-manager";
import type { ApprovalDecision } from "../approval-types";
import type { ToolUseContent } from "@/foundation";

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

    // Resolve so the promise doesn't hang
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

    // Only the first should be active
    manager.respond("allow_once");
    decisions.push(await p1);

    // After resolving first, second becomes active
    manager.respond("deny");
    decisions.push(await p2);

    expect(decisions).toEqual(["allow_once", "deny"]);
  });

  test("denies request when queue overflows (MAX_QUEUE_SIZE = 20)", async () => {
    const manager = new ApprovalManager();

    // Fill queue to MAX_QUEUE_SIZE without resolving any
    const promises: Promise<ApprovalDecision>[] = [];
    for (let i = 0; i < 21; i++) {
      promises.push(manager.askUser(makeToolUse(`tool_${i}`)));
    }

    // The 21st should be auto-denied
    const lastDecision = await promises[20]!;
    expect(lastDecision).toBe("deny");
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

    // After resolving, subscriber should get null
    expect(events).toContain(null);
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

    // After unsubscribing, new requests should not trigger callback
    unsubscribe();
    const promise2 = manager.askUser(makeToolUse("write_file"));
    manager.respond("deny");
    await promise2;

    // No new events after unsubscribe (the null from queue empty may have fired)
    expect(events.length).toBe(countBefore);
  });
});
