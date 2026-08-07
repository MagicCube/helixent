import z from "zod";

import { defineTool } from "@/foundation";

import { errorToolResult, okToolResult } from "./tool-result";
import { ensureDirectoryPath, truncateText } from "./tool-utils";

const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_CHARS = 12000;

export const grepSearchTool = defineTool({
  name: "grep_search",
  description: "Search file contents with ripgrep under an absolute directory.",
  parameters: z.object({
    description: z
      .string()
      .describe("Explain why you want to search file contents. Always place `description` as the first parameter."),
    path: z.string().describe("The absolute directory path to search within."),
    pattern: z.string().describe("Text or regex pattern to search for."),
    glob: z.string().describe("Optional glob filter, for example *.ts.").optional(),
    caseSensitive: z.boolean().describe("Whether the search should be case-sensitive.").optional(),
    limit: z.number().int().positive().describe("Maximum number of matches to return.").optional(),
    maxChars: z.number().int().positive().describe("Maximum characters to return.").optional(),
  }),
  invoke: async ({ path, pattern, glob, caseSensitive, limit, maxChars }, signal) => {
    const dirCheck = await ensureDirectoryPath(path);
    if (!dirCheck.ok) {
      return errorToolResult(dirCheck.error, "INVALID_DIRECTORY", { path, pattern, glob });
    }

    const cmd = ["rg", "--line-number", "--no-heading"];
    if (!caseSensitive) {
      cmd.push("--ignore-case");
    }
    if (glob) {
      cmd.push("--glob", glob);
    }
    cmd.push("--", pattern, path);

    try {
      const proc = Bun.spawn({
        cmd,
        stdout: "pipe",
        stderr: "pipe",
      });

      if (signal) {
        const onAbort = () => proc.kill();
        signal.addEventListener("abort", onAbort, { once: true });
        void proc.exited.then(() => signal.removeEventListener("abort", onAbort));
      }

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode !== 0 && exitCode !== 1) {
        const stderr = await new Response(proc.stderr).text();
        return errorToolResult(`grep_search failed with exit code ${exitCode}`, "GREP_FAILED", {
          path,
          pattern,
          glob,
          exitCode,
          stderr,
        });
      }

      const lines = stdout.split("\n").filter(Boolean);
      const capped = lines.slice(0, limit ?? DEFAULT_LIMIT);
      const limited = truncateText(capped.join("\n"), maxChars ?? DEFAULT_MAX_CHARS);
      return okToolResult(`Found ${lines.length} matches for ${pattern}`, {
        path,
        pattern,
        glob,
        caseSensitive: Boolean(caseSensitive),
        totalMatches: lines.length,
        shownMatches: capped.length,
        truncated: limited.truncated || capped.length < lines.length,
        matches: capped,
        content: limited.text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No such file or directory") || message.includes("not found")) {
        return errorToolResult("Failed to run 'rg' (ripgrep). Please ensure ripgrep is installed and available in PATH.", "RG_NOT_FOUND", {
          path,
          pattern,
          message,
        });
      }
      return errorToolResult("grep_search failed to execute.", "GREP_EXEC_FAILED", { path, pattern, message });
    }
  },
});
