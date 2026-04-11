import { describe, expect, it } from "bun:test";

import { BUILTIN_COMMANDS, formatHelp, resolveBuiltinCommand, type SlashCommand } from "../command-registry";

describe("resolveBuiltinCommand", () => {
  it("resolves a bare builtin", () => {
    expect(resolveBuiltinCommand("/clear")).toEqual({ name: "clear", args: "" });
    expect(resolveBuiltinCommand("/exit")).toEqual({ name: "exit", args: "" });
    expect(resolveBuiltinCommand("/help")).toEqual({ name: "help", args: "" });
  });

  it("captures trailing args after a builtin", () => {
    expect(resolveBuiltinCommand("/help clear")).toEqual({ name: "help", args: "clear" });
    expect(resolveBuiltinCommand("/help   skill-creator")).toEqual({
      name: "help",
      args: "skill-creator",
    });
  });

  it("treats input with no leading slash the same way", () => {
    expect(resolveBuiltinCommand("clear")).toEqual({ name: "clear", args: "" });
  });

  it("returns null for unknown commands and empty input", () => {
    expect(resolveBuiltinCommand("/nope")).toBeNull();
    expect(resolveBuiltinCommand("")).toBeNull();
    expect(resolveBuiltinCommand("   ")).toBeNull();
  });
});

describe("formatHelp", () => {
  const commands: SlashCommand[] = [
    ...BUILTIN_COMMANDS,
    { name: "skill-creator", description: "Create new skills", type: "skill" },
  ];

  it("lists builtins and skills when called with no target", () => {
    const text = formatHelp(commands);
    expect(text).toContain("Available slash commands");
    expect(text).toContain("/clear");
    expect(text).toContain("/help");
    expect(text).toContain("/skill-creator");
    expect(text).toContain("Create new skills");
  });

  it("renders details for a single command", () => {
    const text = formatHelp(commands, "clear");
    expect(text).toContain("/clear");
    expect(text).toContain("Built-in command");
    expect(text).toContain("Clear the current conversation history");
  });

  it("tolerates a leading slash and case in target", () => {
    const text = formatHelp(commands, "/CLEAR");
    expect(text).toContain("/clear");
  });

  it("returns an error message for unknown targets", () => {
    const text = formatHelp(commands, "nope");
    expect(text).toContain("Unknown command");
    expect(text).toContain("/nope");
  });
});
