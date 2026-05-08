import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { AssistantMessage, NonSystemMessage, UserMessage } from "@/foundation";
import { listSessions, getProjectDir, loadTranscript } from "@/agent/transcript";
import type { SessionInfo } from "@/agent/transcript";

import type { PromptSubmission, SlashCommand } from "../command-registry";
import { formatHelp, resolveBuiltinCommand } from "../command-registry";

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  // eslint-disable-next-line no-unused-vars
  onSubmit: (submission: PromptSubmission) => Promise<void>;
  abort: () => void;
  tokenCount: number;
  resumeRequest: SessionInfo[] | null;
  // eslint-disable-next-line no-unused-vars
  handleResumeSelect: (session: SessionInfo | null) => void;
};

const AgentLoopContext = createContext<AgentLoopState | null>(null);

export function AgentLoopProvider({
  agent,
  commands = [],
  children,
}: {
  agent: Agent;
  commands?: SlashCommand[];
  children: ReactNode;
}) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);
  const [resumeRequest, setResumeRequest] = useState<SessionInfo[] | null>(null);

  const streamingRef = useRef(streaming);
  const pendingMessagesRef = useRef<NonSystemMessage[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  const flushPendingMessages = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (pendingMessagesRef.current.length === 0) return;

    const pending = pendingMessagesRef.current;
    pendingMessagesRef.current = [];
    setMessages((prev) => [...prev, ...pending]);
  }, []);

  const enqueueMessage = useCallback(
    (message: NonSystemMessage) => {
      pendingMessagesRef.current.push(message);
      if (flushTimerRef.current) return;

      flushTimerRef.current = setTimeout(() => {
        flushPendingMessages();
      }, 50);
    },
    [flushPendingMessages],
  );

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const abort = useCallback(() => {
    agent.abort();
  }, [agent]);

  const tokenCount = useMemo(() => {
    return calculateTotalTokens(messages);
  }, [messages]);

  const handleResumeSelect = useCallback(
    (session: SessionInfo | null) => {
      setResumeRequest(null);
      if (!session) return;
      agent.clearMessages();
      const restored = loadTranscript(session.path);
      for (const msg of restored) {
        agent.messages.push(msg);
      }
      flushPendingMessages();
      // Show a summary message followed by the last complete turn for context
      const summaryMsg: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: `Resumed session with ${restored.length} messages.` }],
      };
      // Find the last assistant message with text content (the actual reply)
      // then include from the preceding user message through that reply
      const recentMessages = getLastCompleteTurn(restored);
      setMessages([summaryMsg, ...recentMessages]);
    },
    [agent, flushPendingMessages],
  );

  const onSubmit = useCallback(
    async (submission: PromptSubmission) => {
      const { text, requestedSkillName } = submission;
      const invocation = resolveBuiltinCommand(text);

      if (invocation?.name === "exit" || invocation?.name === "quit") {
        process.exit(0);
        return;
      }

      if (streamingRef.current) return;

      if (invocation?.name === "clear") {
        agent.clearMessages();
        flushPendingMessages();
        setMessages([]);
        clearTerminal();
        return;
      }

      if (invocation?.name === "help") {
        flushPendingMessages();
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        const helpMessage: AssistantMessage = {
          role: "assistant",
          content: [
            {
              type: "text",
              text: formatHelp(commands, invocation.args || undefined),
            },
          ],
        };
        setMessages((prev) => [...prev, userMessage, helpMessage]);
        return;
      }

      if (invocation?.name === "resume") {
        const sessions = listSessions(getProjectDir(process.cwd()));
        if (sessions.length === 0) {
          const noSessionMsg: AssistantMessage = {
            role: "assistant",
            content: [{ type: "text", text: "No previous sessions found." }],
          };
          setMessages((prev) => [...prev, noSessionMsg]);
        } else {
          setResumeRequest(sessions);
        }
        return;
      }

      setStreaming(true);

      try {
        agent.setRequestedSkillName(requestedSkillName);
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => [...prev, userMessage]);

        const stream = agent.stream(userMessage);
        for await (const event of stream) {
          if (event.type === "message") {
            enqueueMessage(event.message);
          }
          // progress events intentionally ignored: the UI shows a generic
          // "Thinking..." shimmer driven by the `streaming` boolean, and
          // MessageHistory is the single source of truth for tool calls.
        }
      } catch (error) {
        if (isAbortError(error)) return;
        // Display API/model errors as assistant messages instead of crashing
        const errorMessage = error instanceof Error ? error.message : String(error);
        enqueueMessage({
          role: "assistant",
          content: [{ type: "text", text: `Error: ${errorMessage}\n\nYou can try again.` }],
        });
      } finally {
        agent.setRequestedSkillName(null);
        flushPendingMessages();
        setStreaming(false);
      }
    },
    [agent, commands, enqueueMessage, flushPendingMessages],
  );

  const value = useMemo(
    () => ({
      agent,
      streaming,
      messages,
      onSubmit,
      abort,
      tokenCount,
      resumeRequest,
      handleResumeSelect,
    }),
    [abort, agent, messages, onSubmit, streaming, tokenCount, resumeRequest, handleResumeSelect],
  );

  return createElement(AgentLoopContext.Provider, { value }, children);
}

function useAgentLoopState(): AgentLoopState {
  const state = useContext(AgentLoopContext);
  if (!state) {
    throw new Error("useAgentLoop() must be used within <AgentLoopProvider agent={...}>");
  }
  return state;
}

function calculateTotalTokens(messages: NonSystemMessage[]): number {
  return messages.reduce((total, message) => {
    if (!isAssistantMessage(message)) return total;
    return total + (message.usage?.totalTokens ?? 0);
  }, 0);
}

function isAssistantMessage(message: NonSystemMessage): message is AssistantMessage {
  return message.role === "assistant";
}

export function useAgentLoop() {
  return useAgentLoopState();
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && error.constructor.name === "APIUserAbortError") return true;
  return false;
}

function clearTerminal() {
  if (!process.stdout.isTTY) return;
  process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
}

/**
 * Extract the last complete turn (user question + all assistant responses)
 * from restored messages, so the user can see where they left off.
 */
function getLastCompleteTurn(messages: NonSystemMessage[]): NonSystemMessage[] {
  // Walk backwards to find the last assistant message with text content
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (msg.role === "assistant" && msg.content.some((c) => c.type === "text")) {
      lastAssistantIdx = i;
      break;
    }
  }
  if (lastAssistantIdx === -1) {
    // No text reply found, just return last 2 messages
    return messages.slice(-2);
  }

  // Find the user message that started this turn
  let turnStartIdx = lastAssistantIdx;
  for (let i = lastAssistantIdx - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      turnStartIdx = i;
      break;
    }
  }

  // Return from the user question through all messages up to and including the assistant reply
  return messages.slice(turnStartIdx, lastAssistantIdx + 1);
}
