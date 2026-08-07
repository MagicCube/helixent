import { existsSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import { bashTool } from "../bash";

function zshOnPath(): boolean {
  return ["/bin/zsh", "/usr/bin/zsh"].some((p) => existsSync(p));
}

describe("bashTool", () => {
  test.skipIf(!zshOnPath())("returns stdout for a successful command", async () => {
    const result = await bashTool.invoke({
      description: "Echo greeting",
      command: "printf 'hi\\n'",
    });

    expect(result).toBe("hi\n");
  });

  test.skipIf(!zshOnPath())("returns an error string when the command fails", async () => {
    const result = await bashTool.invoke({
      description: "Force non-zero exit",
      command: "exit 42",
    });

    expect(result).toMatch(/^Error: Command exit 42 failed with exit code 42:/);
  });

  test.skipIf(!zshOnPath())(
    "drains large stderr output without deadlocking",
    async () => {
      const command = "head -c 2097152 /dev/zero >&2; exit 7";
      const result = await bashTool.invoke({
        description: "Write more stderr than a pipe buffer before exiting",
        command,
      });

      expect(result).toContain(`Error: Command ${command} failed with exit code 7:`);
    },
    10000,
  );
});
