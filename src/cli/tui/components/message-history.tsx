import { Box, Text } from "ink";
import { memo } from "react";

import type { AssistantMessage, NonSystemMessage, ToolMessage, ToolUseContent, UserMessage } from "@/foundation";

import { currentTheme } from "../themes";
import { getCurrentTodo, getNextTodo, snapshotKey, type TodoItemView } from "../todo-view";

import { Markdown } from "./markdown";

export const MessageHistory = memo(function MessageHistory({
  messages,
  startIndex = 0,
  todoSnapshots,
  toolUses,
}: {
  messages: NonSystemMessage[];
  startIndex?: number;
  todoSnapshots: Map<string, TodoItemView[]>;
  toolUses: Map<string, ToolUseContent>;
}) {
  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      {messages.map((message, index) => {
        return (
          <MessageHistoryItem
            key={getMessageKey(message, index)}
            message={message}
            messageIndex={startIndex + index}
            todoSnapshots={todoSnapshots}
            toolUses={toolUses}
          />
        );
      })}
    </Box>
  );
});

export const MessageHistoryItem = memo(function MessageHistoryItem({
  message,
  messageIndex,
  todoSnapshots,
  toolUses,
}: {
  message: NonSystemMessage;
  messageIndex: number;
  todoSnapshots: Map<string, TodoItemView[]>;
  toolUses: Map<string, ToolUseContent>;
}) {
  switch (message.role) {
    case "user":
      return <UserMessageItem message={message} />;
    case "assistant":
      return <AssistantMessageItem message={message} todoSnapshots={todoSnapshots} messageIndex={messageIndex} />;
    case "tool":
      return <ToolMessageItem message={message} toolUses={toolUses} />;
    default:
      return null;
  }
});

const UserMessageItem = memo(function UserMessageItem({ message }: { message: UserMessage }) {
  return (
    <Box columnGap={1} width="100%" backgroundColor={currentTheme.colors.secondaryBackground}>
      <Text color="white" bold>
        ❯
      </Text>
      <Text color="white">
        {message.content.map((content) => (content.type === "text" ? content.text : "[image]")).join("\n")}
      </Text>
    </Box>
  );
});

const AssistantMessageItem = memo(function AssistantMessageItem({
  message,
  todoSnapshots,
  messageIndex,
}: {
  message: AssistantMessage;
  todoSnapshots: Map<string, TodoItemView[]>;
  messageIndex: number;
}) {
  return (
    <Box flexDirection="column" width="100%">
      {message.content.map((content, i) => {
        switch (content.type) {
          case "text":
            if (content.text) {
              return (
                <Box key={i} columnGap={1}>
                  <Text color={currentTheme.colors.highlightedText}>⏺</Text>
                  <Box flexDirection="column">
                    <Markdown>{content.text}</Markdown>
                  </Box>
                </Box>
              );
            }
            return null;
          case "tool_use":
            return (
              <Box key={i} columnGap={1}>
                <Text color={currentTheme.colors.dimText}>⏺</Text>
                <Box flexDirection="column">
                  <ToolUseContentItem content={content} todos={todoSnapshots.get(snapshotKey(messageIndex, i))} />
                </Box>
              </Box>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
});

const ToolUseContentItem = memo(function ToolUseContentItem({
  content,
  todos,
}: {
  content: ToolUseContent;
  todos?: TodoItemView[];
}) {
  switch (content.name) {
    case "bash":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>└─ {content.input.command as string}</Text>
        </Box>
      );
    case "str_replace":
    case "read_file":
    case "write_file":
    case "list_files":
    case "file_info":
    case "mkdir":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>└─ {content.input.path as string}</Text>
        </Box>
      );
    case "glob_search":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>
            └─ {(content.input.path as string) + " :: " + (content.input.pattern as string)}
          </Text>
        </Box>
      );
    case "grep_search":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>
            └─ {(content.input.path as string) + " :: " + (content.input.pattern as string)}
          </Text>
        </Box>
      );
    case "move_path":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>└─ {(content.input.from as string) + " -> " + (content.input.to as string)}</Text>
        </Box>
      );
    case "apply_patch":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.dimText}>└─ unified diff patch</Text>
        </Box>
      );
    case "todo_write": {
      const visibleTodos = todos;
      const currentTodo = getCurrentTodo(visibleTodos);
      const nextTodo = getNextTodo(visibleTodos);
      const summaryTodo = currentTodo ?? nextTodo;
      const completedCount = visibleTodos?.filter((todo) => todo.status === "completed").length ?? 0;
      const pendingCount = visibleTodos?.filter((todo) => todo.status === "pending").length ?? 0;

      return (
        <Box flexDirection="column">
          <Text>{summaryTodo ? `Working on: ${summaryTodo.content}` : "Todo list complete"}</Text>
          {(completedCount > 0 || pendingCount > 0) && (
            <Text color={currentTheme.colors.dimText}>
              └─ {completedCount} completed{pendingCount > 0 ? `, ${pendingCount} pending` : ""}
            </Text>
          )}
        </Box>
      );
    }
    default:
      return (
        <Box flexDirection="column">
          <Text>Tool call</Text>
          <Text color={currentTheme.colors.dimText}>└─ {content.name}</Text>
        </Box>
      );
  }
});

const ToolMessageItem = memo(function ToolMessageItem({
  message,
  toolUses,
}: {
  message: ToolMessage;
  toolUses: Map<string, ToolUseContent>;
}) {
  const visibleContent = message.content.flatMap((content) => {
    const toolUse = toolUses.get(content.tool_use_id);
    const rendered = summarizeToolResult(content.content, toolUse);
    return rendered ? [{ ...content, content: rendered }] : [];
  });
  if (visibleContent.length === 0) return null;

  return (
    <Box flexDirection="column" width="100%">
      {visibleContent.map((content, i) => (
        <Box key={i} columnGap={1}>
          <Text color={currentTheme.colors.dimText}>✓</Text>
          <Box flexDirection="column">
            <Text color={currentTheme.colors.dimText}>{content.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
});

function getMessageKey(message: NonSystemMessage, index: number) {
  switch (message.role) {
    case "user":
      return `user:${index}:${message.content.map((content) => (content.type === "text" ? content.text : "image")).join("|")}`;
    case "assistant":
      return `assistant:${index}:${message.content
        .map((content) => (content.type === "tool_use" ? content.id : content.type))
        .join("|")}`;
    case "tool":
      return `tool:${index}:${message.content.map((content) => content.tool_use_id).join("|")}`;
    default:
      return `${index}`;
  }
}

function summarizeToolResult(content: string, toolUse?: ToolUseContent) {
  if (!toolUse) return content;
  if (content.startsWith("Error:")) return content;

  switch (toolUse.name) {
    case "todo_write":
    case "bash":
    case "write_file":
    case "str_replace":
      return null;
    case "read_file":
    case "list_files":
    case "glob_search":
    case "grep_search":
    case "file_info":
    case "mkdir":
    case "move_path":
    case "apply_patch":
      return summarizeStructuredToolResult(content);
    default:
      return content;
  }
}

function summarizeStructuredToolResult(content: string) {
  try {
    const parsed = JSON.parse(content) as {
      ok?: boolean;
      summary?: unknown;
      error?: unknown;
      code?: unknown;
    };

    if (parsed.ok === true && typeof parsed.summary === "string") {
      return parsed.summary;
    }

    if (parsed.ok === false) {
      const message = typeof parsed.summary === "string" ? parsed.summary : typeof parsed.error === "string" ? parsed.error : content;
      const code = typeof parsed.code === "string" ? parsed.code : null;
      return code ? `Error [${code}]: ${message}` : `Error: ${message}`;
    }
  } catch {
    return content;
  }

  return content;
}
