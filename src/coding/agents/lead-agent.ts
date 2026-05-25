import { join } from "path";

import { Agent } from "@/agent";
import { createSkillsMiddleware } from "@/agent/skills/skills-middleware";
import { createTodoSystem } from "@/agent/todos/todos";
import { createUserMessage, type Model, type NonSystemMessage, type ToolUseContent } from "@/foundation";

import {
  type ApprovalDecision,
  type ApprovalPersistence,
  CODING_TOOLS_REQUIRING_APPROVAL,
  createCodingApprovalMiddleware,
} from "../permissions";
import { applyPatchTool } from "../tools/apply-patch";
import {
  createAskUserQuestionTool,
  type AskUserQuestionParameters,
  type AskUserQuestionResult,
} from "../tools/ask-user-question";
import { bashTool } from "../tools/bash";
import { fileInfoTool } from "../tools/file-info";
import { globSearchTool } from "../tools/glob-search";
import { grepSearchTool } from "../tools/grep-search";
import { listFilesTool } from "../tools/list-files";
import { mkdirTool } from "../tools/mkdir";
import { movePathTool } from "../tools/move-path";
import { readFileTool } from "../tools/read-file";
import { strReplaceTool } from "../tools/str-replace";
import { writeFileTool } from "../tools/write-file";

export async function createCodingAgent({
  model,
  cwd = process.cwd(),
  skillsDirs = [join(process.cwd(), ".agents/skills")],
  askUser,
  askUserQuestion,
  approvalPersistence,
}: {
  model: Model;
  cwd?: string;
  skillsDirs?: string[];
  // eslint-disable-next-line no-unused-vars
  askUser?: (toolUse: ToolUseContent) => Promise<ApprovalDecision>;
  // eslint-disable-next-line no-unused-vars
  askUserQuestion?: (params: AskUserQuestionParameters) => Promise<AskUserQuestionResult>;
  approvalPersistence?: ApprovalPersistence;
}) {
  const agentsFile = Bun.file(`${cwd}/AGENTS.md`);
  const messages: NonSystemMessage[] = [];
  if (await agentsFile.exists()) {
    const agentsFileContent = await agentsFile.text();
    messages.push(
      createUserMessage("> The `AGENTS.md` file has been automatically loaded. Here is the content:\n\n" + agentsFileContent),
    );
  }
  const { tool: todoTool, middleware: todoMiddleware } = createTodoSystem();

  const askUserQuestionTool = askUserQuestion ? createAskUserQuestionTool(askUserQuestion) : null;

  const middlewares = [createSkillsMiddleware(skillsDirs), todoMiddleware];
  if (askUser) {
    middlewares.push(
      createCodingApprovalMiddleware({
        cwd,
        requiresApproval: CODING_TOOLS_REQUIRING_APPROVAL,
        askUser,
        approvalPersistence,
      }),
    );
  }

  return new Agent({
    model,
    prompt: `<agent name="Helixent" role="leading_agent" description="A coding agent">
Use the given tools and skills to perform parallel/sequential operations and solve the user's problem in the given working directory.
</agent>

<working_directory dir="${cwd}/" />

<tool_usage>
- Inspect directories before assuming file paths.
- Prefer list_files or glob_search to discover files.
- Prefer grep_search to locate relevant content.
- Read a file before editing it.
- Prefer apply_patch for targeted edits.
- If apply_patch fails, re-read the file and choose a safer edit strategy.
- Do not repeat the same failing tool call with unchanged invalid input.
- Use tool result summaries and error codes to decide the next step.
</tool_usage>

<notes>
- Never try to start a local static server. Let the user do it.
- If the user's input is a simple task or a greeting, you should just respond with a simple answer and then stop.
</notes>
`,
    messages,
    tools: [
      bashTool,
      fileInfoTool,
      listFilesTool,
      globSearchTool,
      grepSearchTool,
      mkdirTool,
      movePathTool,
      readFileTool,
      writeFileTool,
      strReplaceTool,
      applyPatchTool,
      todoTool,
      ...(askUserQuestionTool ? [askUserQuestionTool] : []),
    ],
    middlewares,
  });
}
