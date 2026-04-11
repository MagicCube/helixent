import type { AgentMiddleware } from "@/agent/agent-middleware";
import type { ToolUseContent } from "@/foundation";

import type { ApprovalPersistence } from "./approval-persistence";
import type { ApprovalDecision } from "./approval-types";

const emptyAllowList = async (): Promise<Set<string>> => new Set();

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
      if (!options.requiresApproval.includes(toolUse.name)) {
        return;
      }
      const allowed = await loadAllowList(options.cwd);
      if (allowed.has(toolUse.name)) {
        return;
      }
      const decision = await options.askUser(toolUse);
      if (decision === "deny") {
        return {
          __skip: true,
          result: `User denied execution of tool: ${toolUse.name}. You must either find an alternative approach or ask the user for clarification.`,
        };
      }
      if (decision === "allow_always_project" && persistAllowedTool) {
        try {
          await persistAllowedTool(options.cwd, toolUse.name);
        } catch (e) {
          console.warn(`[helixent] Could not persist allow for ${toolUse.name}:`, e);
        }
      }
    },
  };
}
