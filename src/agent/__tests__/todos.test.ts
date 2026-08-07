import { describe, expect, test } from "bun:test";

import { createTodoSystem } from "../todos/todos";

const mockContext = { prompt: "", messages: [], tools: [] } as never;

describe("createTodoSystem", () => {
  describe("tool invocation", () => {
    test("replaces list when merge is false", async () => {
      const { tool } = createTodoSystem();
      const result = await tool.invoke({
        todos: [
          { id: "1", content: "Task A", status: "pending" },
          { id: "2", content: "Task B", status: "in_progress" },
        ],
        merge: false,
      });
      expect(result).toContain("2 items");
      expect(result).toContain("1 pending");
      expect(result).toContain("1 in_progress");
    });

    test("merges by id when merge is true", async () => {
      const { tool } = createTodoSystem();
      await tool.invoke({
        todos: [
          { id: "1", content: "Task A", status: "pending" },
          { id: "2", content: "Task B", status: "pending" },
        ],
        merge: false,
      });

      const result = await tool.invoke({
        todos: [{ id: "1", content: "Task A updated", status: "completed" }],
        merge: true,
      });
      expect(result).toContain("2 items");
      expect(result).toContain("1 completed");
      expect(result).toContain("1 pending");
    });

    test("appends new items when merging with new ids", async () => {
      const { tool } = createTodoSystem();
      await tool.invoke({
        todos: [{ id: "1", content: "Task A", status: "pending" }],
        merge: false,
      });

      const result = await tool.invoke({
        todos: [{ id: "2", content: "Task B", status: "pending" }],
        merge: true,
      });
      expect(result).toContain("2 items");
      expect(result).toContain("2 pending");
    });

    test("handles empty todo list", async () => {
      const { tool } = createTodoSystem();
      const result = await tool.invoke({ todos: [], merge: false });
      expect(result).toContain("0 items");
    });

    test("counts all status types correctly", async () => {
      const { tool } = createTodoSystem();
      const result = await tool.invoke({
        todos: [
          { id: "1", content: "A", status: "pending" },
          { id: "2", content: "B", status: "in_progress" },
          { id: "3", content: "C", status: "completed" },
          { id: "4", content: "D", status: "cancelled" },
        ],
        merge: false,
      });
      expect(result).toContain("4 items");
      expect(result).toContain("1 pending");
      expect(result).toContain("1 in_progress");
      expect(result).toContain("1 completed");
      expect(result).toContain("1 cancelled");
    });
  });

  describe("middleware", () => {
    test("beforeModel does nothing when store is empty", async () => {
      const { middleware } = createTodoSystem();
      const result = await middleware.beforeModel?.({
        modelContext: { prompt: "hello", messages: [] },
        agentContext: mockContext,
      });
      expect(result).toBeUndefined();
    });
  });
});
