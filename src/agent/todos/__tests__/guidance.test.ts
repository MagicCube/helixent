import { describe, expect, test } from "bun:test";

import { createTodoSystem } from "../todos";

describe("todo_write guidance", () => {
  test("new-instruction guidance uses merge=true rather than replacement", () => {
    const { tool } = createTodoSystem();
    const newInstructionLine = tool.description
      .split("\n")
      .find((line) => line.includes("After receiving new instructions"));

    expect(newInstructionLine).toBeDefined();
    expect(newInstructionLine).toMatch(/merge\s*=\s*true/i);
    expect(newInstructionLine).not.toMatch(/merge\s*=\s*false/i);
  });
});
