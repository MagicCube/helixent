import { Box, Text } from "ink";
import Spinner from "ink-spinner";

import type { AssistantMessage, NonSystemMessage, ToolMessage, ToolUseContent, UserMessage } from "@/foundation";

import { currentTheme } from "../themes";

import { Markdown } from "./markdown";

export function MessageHistory({ messages }: { messages: NonSystemMessage[]; streaming: boolean }) {
  const todoSnapshots = buildTodoSnapshots(messages);
  const latestTodoSnapshotKey = getLatestTodoSnapshotKey(messages);

  return (
    <Box flexDirection="column" rowGap={1} overflowY="visible" width="100%">
      {messages.map((message, index) => {
        switch (message.role) {
          case "user":
            return <UserMessageItem key={index} message={message} />;
          case "assistant":
            return (
              <AssistantMessageItem
                key={index}
                message={message}
                todoSnapshots={todoSnapshots}
                latestTodoSnapshotKey={latestTodoSnapshotKey}
                messageIndex={index}
              />
            );
          case "tool":
            return <ToolMessageItem key={index} message={message} />;
          default:
            return null;
        }
      })}
    </Box>
  );
}

export function UserMessageItem({ message }: { message: UserMessage }) {
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
}

export function AssistantMessageItem({
  message,
  todoSnapshots,
  latestTodoSnapshotKey,
  messageIndex,
}: {
  message: AssistantMessage;
  todoSnapshots: Map<string, TodoItemView[]>;
  latestTodoSnapshotKey: string | null;
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
            const key = snapshotKey(messageIndex, i);
            return (
              <Box key={i} columnGap={1}>
                <Text color={currentTheme.colors.secondaryText}>⏺</Text>
                <Box flexDirection="column">
                  <ToolUseContentItem
                    content={content}
                    todos={todoSnapshots.get(key)}
                    animate={key === latestTodoSnapshotKey}
                  />
                </Box>
              </Box>
            );
          default:
            return null;
        }
      })}
    </Box>
  );
}

export function ToolUseContentItem({
  content,
  todos,
  animate = false,
}: {
  content: ToolUseContent;
  todos?: TodoItemView[];
  animate?: boolean;
}) {
  switch (content.name) {
    case "bash":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.secondaryText}>└─ {content.input.command as string}</Text>
        </Box>
      );
    case "str_replace":
    case "read_file":
    case "write_file":
      return (
        <Box flexDirection="column">
          <Text>{content.input.description as string}</Text>
          <Text color={currentTheme.colors.secondaryText}>└─ {content.input.path as string}</Text>
        </Box>
      );
    case "todo_write": {
      const input = toTodoWriteInput(content.input);
      const visibleTodos = todos ?? input.todos;

      return (
        <Box flexDirection="column">
          <Text>{input.merge ? "Update todo list" : "Create todo list"}</Text>
          {Array.isArray(visibleTodos) &&
            visibleTodos.map((todo, i) => (
              <TodoListItem
                key={i}
                prefix={i === 0 ? "└─ " : "   "}
                status={todo.status}
                content={todo.content}
                animate={animate}
              />
            ))}
        </Box>
      );
    }
    default:
      return (
        <Box flexDirection="column">
          <Text>Tool call</Text>
          <Text color={currentTheme.colors.secondaryText}>└─ {content.name}</Text>
        </Box>
      );
  }
}

export function ToolMessageItem({ message }: { message: ToolMessage }) {
  return (
    <Box flexDirection="column" width="100%">
      {message.content.map((content, i) => (
        <Box key={i} columnGap={1}>
          <Text color={currentTheme.colors.secondaryText}>✓</Text>
          <Box flexDirection="column">
            <Text color={currentTheme.colors.secondaryText}>{content.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function TodoListItem({
  prefix,
  status,
  content,
  animate,
}: {
  prefix: string;
  status?: string;
  content?: string;
  animate?: boolean;
}) {
  return (
    <Box>
      <Text color={currentTheme.colors.secondaryText}>{prefix}</Text>
      <TodoStatusIndicator status={status} animate={animate} />
      <Text color={currentTheme.colors.secondaryText}> {content ?? ""}</Text>
    </Box>
  );
}

function TodoStatusIndicator({ status, animate }: { status?: string; animate?: boolean }) {
  switch (status) {
    case "pending":
      return <Text color={currentTheme.colors.secondaryText}>○</Text>;
    case "in_progress":
      return animate ? (
        <Text color={currentTheme.colors.primary}>
          <Spinner type="line" />
        </Text>
      ) : (
        <Text color={currentTheme.colors.primary}>◐</Text>
      );
    case "completed":
      return <Text color="green">✓</Text>;
    case "cancelled":
      return <Text color="red">✕</Text>;
    default:
      return <Text color={currentTheme.colors.secondaryText}>?</Text>;
  }
}

type TodoItemView = {
  id: string;
  content: string;
  status: string;
};

function snapshotKey(messageIndex: number, contentIndex: number) {
  return `${messageIndex}:${contentIndex}`;
}

function getLatestTodoSnapshotKey(messages: NonSystemMessage[]) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (!message || message.role !== "assistant") continue;

    for (let contentIndex = message.content.length - 1; contentIndex >= 0; contentIndex--) {
      const content = message.content[contentIndex];
      if (content && content.type === "tool_use" && content.name === "todo_write") {
        return snapshotKey(messageIndex, contentIndex);
      }
    }
  }

  return null;
}

function buildTodoSnapshots(messages: NonSystemMessage[]): Map<string, TodoItemView[]> {
  const snapshots = new Map<string, TodoItemView[]>();
  let store: TodoItemView[] = [];

  for (const [messageIndex, message] of messages.entries()) {
    if (message.role !== "assistant") continue;

    for (const [contentIndex, content] of message.content.entries()) {
      if (content.type !== "tool_use" || content.name !== "todo_write") continue;

      const input = toTodoWriteInput(content.input);
      store = applyTodoWrite(store, input);
      snapshots.set(snapshotKey(messageIndex, contentIndex), store);
    }
  }

  return snapshots;
}

function toTodoWriteInput(input: Record<string, unknown>): {
  merge: boolean;
  todos: TodoItemView[];
} {
  const merge = input.merge === true;
  const todos = Array.isArray(input.todos)
    ? input.todos.flatMap((item) => {
        if (!item || typeof item !== "object") return [];

        const candidate = item as Record<string, unknown>;
        if (typeof candidate.id !== "string") return [];
        if (typeof candidate.content !== "string") return [];
        if (typeof candidate.status !== "string") return [];

        return [
          {
            id: candidate.id,
            content: candidate.content,
            status: candidate.status,
          },
        ];
      })
    : [];

  return { merge, todos };
}

function applyTodoWrite(store: TodoItemView[], input: { merge: boolean; todos: TodoItemView[] }) {
  if (!input.merge) {
    return [...input.todos];
  }

  const next = [...store];
  for (const item of input.todos) {
    const index = next.findIndex((todo) => todo.id === item.id);
    if (index >= 0) {
      next[index] = item;
    } else {
      next.push(item);
    }
  }

  return next;
}
