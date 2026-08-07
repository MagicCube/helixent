import z from "zod";

import { defineTool, type Tool } from "@/foundation";

import type { AgentMiddleware } from "../agent-middleware";

import type { TodoItem, TodoStatus } from "./types";

const TODO_WRITE_TOOL_NAME = "todo_write";

const REMINDER_CONFIG = {
  STEPS_SINCE_WRITE: 10,
  STEPS_BETWEEN_REMINDERS: 10,
} as const;

const TOOL_DESCRIPTION = `Create and manage a structured task list for the current session. This helps track progress, organize complex tasks, and demonstrate thoroughness.

## When to Use

1. Complex multi-step tasks requiring 3 or more distinct steps
2. Non-trivial tasks requiring careful planning or multiple operations
3. User explicitly requests a todo list
4. User provides multiple tasks (numbered or comma-separated)
5. After receiving new instructions — capture requirements as todos (use merge=false to add new ones)
6. After completing tasks — mark complete with merge=true and add follow-ups
7. When starting new tasks — mark as in_progress (ideally only one at a time)

## When NOT to Use

1. Single, straightforward tasks
2. Trivial tasks with no organizational benefit
3. Tasks completable in fewer than 3 trivial steps
4. Purely conversational or informational requests

## Task States

- pending: Not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Finished successfully
- cancelled: No longer needed

## Task Management Rules

- Update status in real-time as you work
- Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
- Only ONE task should be in_progress at any time
- Complete current tasks before starting new ones
- If blocked, keep the task as in_progress and create a new task for the blocker

## Merge Behavior

- merge=true: Merges by id — existing ids are updated, new ids are appended. You can send only the changed items.
- merge=false: Replaces the entire list with the provided todos.`;

function formatSummary(todos: TodoItem[]): string {
  const counts: Record<TodoStatus, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
  for (const t of todos) counts[t.status]++;
  const parts: string[] = [];
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);
  if (counts.in_progress > 0) parts.push(`${counts.in_progress} in_progress`);
  if (counts.completed > 0) parts.push(`${counts.completed} completed`);
  if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);
  return `Todo list updated. ${todos.length} items: ${parts.join(", ")}.`;
}

function formatReminder(todos: TodoItem[]): string {
  const lines = todos.map((t, i) => `${i + 1}. [${t.status}] ${t.content}`).join("\n");
  return `\n<todo_reminder>
The todo_write tool hasn't been used recently. If you're working on tasks that benefit from tracking, consider updating your todo list. Only use it if relevant to the current work. Here are the current items:

${lines}
</todo_reminder>`;
}

export function createTodoSystem(): { tool: Tool; middleware: AgentMiddleware } {
  const store: TodoItem[] = [];
  let stepsSinceLastWrite = Infinity;
  let stepsSinceLastReminder = Infinity;

  const tool = defineTool({
    name: TODO_WRITE_TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: z.object({
      todos: z
        .array(
          z.object({
            id: z.string().describe("Unique identifier for this todo item."),
            content: z.string().describe("Description of the task."),
            status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status."),
          }),
        )
        .describe("Array of todo items to create or update."),
      merge: z
        .boolean()
        .describe(
          "If true, merges into the existing list by id (existing ids updated, new ids appended). If false, replaces the entire list.",
        ),
    }),
    invoke: async ({ todos, merge }) => {
      if (merge) {
        for (const item of todos) {
          const idx = store.findIndex((t) => t.id === item.id);
          if (idx >= 0) {
            store[idx] = item;
          } else {
            store.push(item);
          }
        }
      } else {
        store.length = 0;
        store.push(...todos);
      }

      stepsSinceLastWrite = 0;
      return formatSummary(store);
    },
  });

  const middleware: AgentMiddleware = {
    onReset: () => {
      store.length = 0;
      stepsSinceLastWrite = Infinity;
      stepsSinceLastReminder = Infinity;
    },

    beforeModel: async ({ modelContext }) => {
      stepsSinceLastWrite++;
      stepsSinceLastReminder++;

      if (
        store.length > 0 &&
        stepsSinceLastWrite >= REMINDER_CONFIG.STEPS_SINCE_WRITE &&
        stepsSinceLastReminder >= REMINDER_CONFIG.STEPS_BETWEEN_REMINDERS
      ) {
        stepsSinceLastReminder = 0;
        return { prompt: modelContext.prompt + formatReminder(store) };
      }
    },

    afterToolUse: async ({ toolUse }) => {
      if (toolUse.name === TODO_WRITE_TOOL_NAME) {
        stepsSinceLastWrite = 0;
      }
    },
  };

  return { tool, middleware };
}
