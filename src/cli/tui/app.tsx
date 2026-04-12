import { Box, useStdout } from "ink";
import { useEffect, useMemo, useRef } from "react";

import type { NonSystemMessage } from "@/foundation";

import type { SlashCommand } from "./command-registry";
import { ApprovalPrompt } from "./components/approval-prompt";
import { AskUserQuestionPrompt } from "./components/ask-user-question-prompt";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { InputBox } from "./components/input-box";
import { MessageHistoryItem } from "./components/message-history";
import { StreamingIndicator } from "./components/streaming-indicator";
import { StreamingMessage } from "./components/streaming-message";
import { TodoPanel } from "./components/todo-panel";
import { useAgentLoop } from "./hooks/use-agent-loop";
import { useApprovalManager } from "./hooks/use-approval-manager";
import { useAskUserQuestionManager } from "./hooks/use-ask-user-question-manager";
import { messageToPlainText } from "./message-text";
import { buildTodoViewState, getNextTodo } from "./todo-view";

function allDone(todos?: { status: string }[]) {
  return !!todos?.length && todos.every((t) => t.status === "completed" || t.status === "cancelled");
}

export function App({
  commands,
  supportProjectWideAllow = false,
}: {
  commands: SlashCommand[];
  supportProjectWideAllow?: boolean;
}) {
  const { streaming, messages, streamingText, printMode, onSubmit, abort } = useAgentLoop();
  const { approvalRequest, respondToApproval } = useApprovalManager();
  const { askUserQuestionRequest, respondWithAnswers } = useAskUserQuestionManager();
  const { latestTodos, todoSnapshots } = useMemo(() => buildTodoViewState(messages), [messages]);
  const nextTodo = getNextTodo(latestTodos)?.content;
  const hideTodos = !streaming && allDone(latestTodos);

  const { write } = useStdout();
  const flushedRef = useRef(0);

  const lastMessage = messages.length > 0
    ? messages[messages.length - 1]!
    : undefined;

  useFlushToScrollback(messages, flushedRef, write);

  // Show streaming text in Ink mode (not print mode)
  const showStreamingText = streaming && streamingText && !printMode;
  // Only show the shimmer indicator when there is no streaming text to display
  const showShimmer = streaming && !streamingText && !approvalRequest && !askUserQuestionRequest;

  return (
    <Box flexDirection="column" width="100%">
      {messages.length === 0 && <Header />}
      <Box flexDirection="column" marginTop={1} rowGap={1}>
        {lastMessage && (
          <MessageHistoryItem
            key={`msg:${lastMessage.role}:${messages.length - 1}`}
            message={lastMessage}
            messageIndex={messages.length - 1}
            todoSnapshots={todoSnapshots}
          />
        )}
        {showStreamingText && <StreamingMessage text={streamingText} />}
        {showShimmer && (
          <StreamingIndicator streaming={streaming} nextTodo={nextTodo} />
        )}
        {!hideTodos && <TodoPanel todos={latestTodos} />}
        {approvalRequest ? (
          <ApprovalPrompt
            toolUse={approvalRequest.toolUse}
            supportProjectWideAllow={supportProjectWideAllow}
            onDecision={respondToApproval}
          />
        ) : askUserQuestionRequest ? (
          <AskUserQuestionPrompt
            questions={askUserQuestionRequest.params.questions}
            onSubmit={respondWithAnswers}
          />
        ) : (
          <InputBox commands={commands} onSubmit={onSubmit} onAbort={abort} />
        )}
      </Box>
      <Footer />
    </Box>
  );
}

function useFlushToScrollback(
  messages: NonSystemMessage[],
  flushedRef: React.MutableRefObject<number>,
  // eslint-disable-next-line no-unused-vars
  write: (data: string) => void,
) {
  useEffect(() => {
    const targetCount = messages.length > 0 ? messages.length - 1 : 0;
    if (targetCount <= flushedRef.current) return;

    const toFlush = messages.slice(flushedRef.current, targetCount);
    for (const msg of toFlush) {
      const text = messageToPlainText(msg);
      if (text) {
        write(text + "\n");
      }
    }
    flushedRef.current = targetCount;
  }, [messages, write, flushedRef]);
}
