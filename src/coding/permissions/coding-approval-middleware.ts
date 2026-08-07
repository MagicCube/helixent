import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { AgentMiddleware } from "@/agent/agent-middleware";
import type { ToolUseContent } from "@/foundation";

import type { ApprovalPersistence } from "./approval-persistence";
import type { ApprovalDecision } from "./approval-types";

const emptyAllowList = async (): Promise<Set<string>> => new Set();

const PATH_FIELDS_BY_TOOL: Record<string, string[]> = {
  read_file: ["path"],
  file_info: ["path"],
  list_files: ["path"],
  glob_search: ["path"],
  grep_search: ["path"],
  write_file: ["path"],
  str_replace: ["path"],
  mkdir: ["path"],
  move_path: ["from", "to"],
};

function extractApplyPatchPaths(patch: string): string[] {
  const paths: string[] = [];
  for (const line of patch.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.startsWith("+++ ")) continue;
    const rawPath = line.slice(4).trim().replace(/^b\//, "").replace(/^a\//, "");
    if (rawPath !== "/dev/null") {
      paths.push(rawPath);
    }
  }
  return paths;
}

function extractToolPaths(toolUse: ToolUseContent): string[] {
  const input = toolUse.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  if (toolUse.name === "apply_patch") {
    const patch = (input as Record<string, unknown>).patch;
    return typeof patch === "string" ? extractApplyPatchPaths(patch) : [];
  }

  const fields = PATH_FIELDS_BY_TOOL[toolUse.name];
  if (!fields) return [];

  const record = input as Record<string, unknown>;
  return fields.flatMap((field) => (typeof record[field] === "string" ? [record[field] as string] : []));
}

function isWithinDirectory(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR"),
  );
}

async function resolveThroughNearestExistingAncestor(path: string): Promise<string | null> {
  if (!isAbsolute(path)) return null;

  const absolutePath = resolve(path);
  let probe = absolutePath;
  while (true) {
    try {
      const canonicalProbe = await realpath(probe);
      const remaining = relative(probe, absolutePath);
      return resolve(canonicalProbe, remaining);
    } catch (error) {
      if (!isMissingPathError(error)) {
        return null;
      }
      const parent = dirname(probe);
      if (parent === probe) {
        return null;
      }
      probe = parent;
    }
  }
}

async function targetsOutsideProject(cwd: string, toolUse: ToolUseContent): Promise<boolean> {
  const paths = extractToolPaths(toolUse);
  if (paths.length === 0) return false;

  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(cwd);
  } catch {
    return true;
  }

  for (const path of paths) {
    const canonicalTarget = await resolveThroughNearestExistingAncestor(path);
    if (!canonicalTarget || !isWithinDirectory(canonicalRoot, canonicalTarget)) {
      return true;
    }
  }
  return false;
}

export function createCodingApprovalMiddleware(options: {
  cwd: string;
  requiresApproval: string[];
  approvalPersistence?: ApprovalPersistence;
  // eslint-disable-next-line no-unused-vars
  askUser: (toolUse: ToolUseContent) => Promise<ApprovalDecision>;
}): AgentMiddleware {
  const loadAllowList = options.approvalPersistence?.loadAllowList ?? emptyAllowList;
  const persistAllowedTool = options.approvalPersistence?.persistAllowedTool;

  return {
    beforeToolUse: async ({ toolUse }) => {
      const outsideProject = await targetsOutsideProject(options.cwd, toolUse);
      const normallyRequiresApproval = options.requiresApproval.includes(toolUse.name);
      if (!normallyRequiresApproval && !outsideProject) {
        return;
      }

      const allowed = await loadAllowList(options.cwd);
      if (allowed.has(toolUse.name) && !outsideProject) {
        return;
      }

      const decision = await options.askUser(toolUse);
      if (decision === "deny") {
        return {
          __skip: true,
          result: `User denied execution of tool: ${toolUse.name}. You must either find an alternative approach or ask the user for clarification.`,
        };
      }

      if (decision === "allow_always_project" && persistAllowedTool && !outsideProject) {
        try {
          await persistAllowedTool(options.cwd, toolUse.name);
        } catch (e) {
          console.warn(`[helixent] Could not persist allow for ${toolUse.name}:`, e);
        }
      }
    },
  };
}
