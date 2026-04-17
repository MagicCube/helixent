import z from "zod";

import { defineTool } from "@/foundation";

import { errorToolResult } from "./tool-result";
import { ensureAbsolutePath, truncateText } from "./tool-utils";

const DEFAULT_MAX_CHARS = 12000;

export const readFileTool = defineTool({
  name: "read_file",
  description: "Read a file from an absolute path. Supports optional line-range reads for large files.",
  parameters: z.object({
    description: z
      .string()
      .describe("Explain why you want to read the file. Always place `description` as the first parameter."),
    path: z.string().describe("The absolute path to the file to read."),
    startLine: z.number().int().positive().describe("1-based starting line to read.").optional(),
    endLine: z.number().int().positive().describe("1-based ending line to read, inclusive.").optional(),
    maxChars: z.number().int().positive().describe("Maximum characters to return from the selected range.").optional(),
  }),
  invoke: async ({ path, startLine, endLine, maxChars }) => {
    const absolute = ensureAbsolutePath(path);
    if (!absolute.ok) {
      return errorToolResult(absolute.error, "INVALID_PATH", { path });
    }

    if (startLine !== undefined && endLine !== undefined && startLine > endLine) {
      return errorToolResult("startLine must be less than or equal to endLine.", "INVALID_RANGE", {
        path,
        startLine,
        endLine,
      });
    }

    const file = Bun.file(path);
    if (!(await file.exists())) {
      return errorToolResult(`File ${path} does not exist.`, "FILE_NOT_FOUND", { path });
    }

    const text = await file.text();
    const lines = text.split("\n");
    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;

    if (start < 0 || start >= lines.length) {
      return errorToolResult(`startLine ${startLine} is out of range for file ${path}.`, "START_LINE_OUT_OF_RANGE", {
        path,
        startLine,
        totalLines: lines.length,
      });
    }

    const selected = lines.slice(start, end);
    const numbered = selected.map((line, index) => `${start + index + 1}: ${line}`).join("\n");
    const limited = truncateText(numbered, maxChars ?? DEFAULT_MAX_CHARS);
    const isWholeFileRead = !startLine && !endLine;

    // Do NOT return a structured result here.
    // Instead, return the raw text.
    // TODO: add line numbers to the result with padding to the left.
    return isWholeFileRead && !limited.truncated ? text : limited.text;
  },
});
