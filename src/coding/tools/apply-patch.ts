import { exists, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import z from "zod";

import { defineTool } from "@/foundation";

import { errorToolResult, okToolResult } from "./tool-result";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@$/;

type HunkLine = { type: "context" | "delete" | "add"; text: string };

type PatchHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
};

type PatchFile = {
  oldPath: string;
  newPath: string;
  hunks: PatchHunk[];
};

function normalizePatchPath(rawPath: string) {
  return rawPath.replace(/^b\//, "").replace(/^a\//, "");
}

function parsePatch(patch: string): PatchFile[] {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const files: PatchFile[] = [];
  let current: PatchFile | null = null;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.startsWith("--- ")) {
      const next = lines[index + 1] ?? "";
      if (!next.startsWith("+++ ")) {
        throw new Error("Patch is missing +++ header after --- header.");
      }
      current = {
        oldPath: normalizePatchPath(line.slice(4).trim()),
        newPath: normalizePatchPath(next.slice(4).trim()),
        hunks: [],
      };
      files.push(current);
      index += 2;
      continue;
    }

    const header = line.match(HUNK_HEADER);
    if (header) {
      if (!current) {
        throw new Error("Encountered hunk before file header.");
      }
      const hunk: PatchHunk = {
        oldStart: Number(header[1]),
        oldCount: Number(header[2] ?? 1),
        newStart: Number(header[3]),
        newCount: Number(header[4] ?? 1),
        lines: [],
      };
      index += 1;
      while (index < lines.length) {
        const hunkLine = lines[index] ?? "";
        if (hunkLine.startsWith("@@ ") || hunkLine.startsWith("--- ")) {
          break;
        }
        if (hunkLine === "\\ No newline at end of file") {
          index += 1;
          continue;
        }
        if (hunkLine === "") {
          index += 1;
          continue;
        }
        const prefix = hunkLine[0];
        const text = hunkLine.slice(1);
        if (prefix === " ") {
          hunk.lines.push({ type: "context", text });
        } else if (prefix === "-") {
          hunk.lines.push({ type: "delete", text });
        } else if (prefix === "+") {
          hunk.lines.push({ type: "add", text });
        } else {
          throw new Error(`Unsupported hunk line: ${hunkLine}`);
        }
        index += 1;
      }
      current.hunks.push(hunk);
      continue;
    }

    index += 1;
  }

  if (files.length === 0) {
    throw new Error("Patch does not contain any file changes.");
  }
  return files;
}

function validateHunkCounts(hunk: PatchHunk, filePath: string) {
  let oldSeen = 0;
  let newSeen = 0;

  for (const line of hunk.lines) {
    if (line.type === "context") {
      oldSeen += 1;
      newSeen += 1;
    } else if (line.type === "delete") {
      oldSeen += 1;
    } else {
      newSeen += 1;
    }
  }

  if (oldSeen !== hunk.oldCount || newSeen !== hunk.newCount) {
    throw new Error(
      `Hunk count mismatch for ${filePath} at @@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@. ` +
        `Observed old=${oldSeen}, new=${newSeen}.`,
    );
  }
}

function applyHunks(original: string, file: PatchFile) {
  const normalizedOriginal = original.replace(/\r\n/g, "\n");
  const sourceLines = original === "" ? [] : normalizedOriginal.split("\n");
  const logicalLineCount =
    normalizedOriginal.endsWith("\n") && sourceLines.length > 0 ? sourceLines.length - 1 : sourceLines.length;
  const output: string[] = [];
  let sourceIndex = 0;

  for (const hunk of file.hunks) {
    validateHunkCounts(hunk, file.newPath);

    if (hunk.oldCount === 0) {
      if (hunk.oldStart > logicalLineCount) {
        throw new Error(
          `Hunk start ${hunk.oldStart} is beyond the end of ${file.newPath} (${logicalLineCount} source lines).`,
        );
      }
    } else {
      const lastConsumedLine = hunk.oldStart + hunk.oldCount - 1;
      if (hunk.oldStart < 1 || lastConsumedLine > logicalLineCount) {
        throw new Error(
          `Hunk range ${hunk.oldStart}-${lastConsumedLine} is beyond the end of ${file.newPath} (${logicalLineCount} source lines).`,
        );
      }
    }

    const expectedIndex = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;
    if (expectedIndex < sourceIndex) {
      throw new Error(
        `Patch hunks are overlapping or out of order in ${file.newPath}: hunk starts at line ${hunk.oldStart} after the source cursor advanced to line ${sourceIndex + 1}.`,
      );
    }

    while (sourceIndex < expectedIndex) {
      output.push(sourceLines[sourceIndex] ?? "");
      sourceIndex += 1;
    }

    for (const line of hunk.lines) {
      if (line.type === "context") {
        const actual = sourceLines[sourceIndex] ?? "";
        if (actual !== line.text) {
          throw new Error(
            `Context mismatch in ${file.newPath} at line ${sourceIndex + 1}: expected ${JSON.stringify(line.text)}, got ${JSON.stringify(actual)}`,
          );
        }
        output.push(actual);
        sourceIndex += 1;
      } else if (line.type === "delete") {
        const actual = sourceLines[sourceIndex] ?? "";
        if (actual !== line.text) {
          throw new Error(
            `Delete mismatch in ${file.newPath} at line ${sourceIndex + 1}: expected ${JSON.stringify(line.text)}, got ${JSON.stringify(actual)}`,
          );
        }
        sourceIndex += 1;
      } else {
        output.push(line.text);
      }
    }
  }

  while (sourceIndex < sourceLines.length) {
    output.push(sourceLines[sourceIndex] ?? "");
    sourceIndex += 1;
  }

  return output.join("\n");
}

export const applyPatchTool = defineTool({
  name: "apply_patch",
  description:
    "Apply a unified diff patch to one or more files using absolute paths in the patch headers. Note: File deletion is not supported (will fail if +++ /dev/null is used).",
  parameters: z.object({
    description: z
      .string()
      .describe("Explain why you want to apply the patch. Always place `description` as the first parameter."),
    patch: z.string().describe("Unified diff patch content with --- and +++ headers. Must use absolute paths."),
  }),
  invoke: async ({ patch }) => {
    try {
      const files = parsePatch(patch);
      const changedFiles: string[] = [];

      for (const file of files) {
        if (!file.newPath.startsWith("/")) {
          return errorToolResult(`Patch paths must be absolute. Received: ${file.newPath}`, "INVALID_PATCH_PATH", {
            oldPath: file.oldPath,
            newPath: file.newPath,
          });
        }

        if (file.newPath === "/dev/null") {
          return errorToolResult(
            "File deletion (+++ /dev/null) is currently not supported by apply_patch.",
            "DELETE_NOT_SUPPORTED",
            {
              oldPath: file.oldPath,
              newPath: file.newPath,
            },
          );
        }

        const target = Bun.file(file.newPath);
        const original = (await target.exists()) ? await target.text() : "";
        const updated = applyHunks(original, file);
        const parent = dirname(file.newPath);

        if (!(await exists(parent))) {
          await mkdir(parent, { recursive: true });
        }

        await target.write(updated);
        changedFiles.push(file.newPath);
      }

      return okToolResult(`Applied patch to ${changedFiles.length} file(s).`, {
        fileCount: changedFiles.length,
        changedFiles,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorToolResult(message, "PATCH_APPLY_FAILED");
    }
  },
});
