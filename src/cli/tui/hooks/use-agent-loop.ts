import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import { listSessions, getProjectDir, loadTranscript } from "@/agent/transcript";
import type { SessionInfo } from "@/agent/transcript";
import type { AssistantMessage, NonSystemMessage, UserMessage } from "@/foundation";

import type { PromptSubmission, SlashCommand } from "../command-registry";
import { formatHelp, resolveBuiltinCommand } from "../command-registry";
import { calculateTokenUsage, type TokenUsageSummary } from "../token-usage";

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  // eslint-disable-next-line no-unused-vars
  onSubmit: (submission: PromptSubmission) => Promise<void>;
  abort: () => void;
  tokenUsage: TokenUsageSummary;
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

  const tokenUsage = useMemo(() => {
    return calculateTokenUsage(messages);
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
      const summaryMsg: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: `Resumed session with ${restored.length} messages.` }],
      };
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
      tokenUsage,
      resumeRequest,
      handleResumeSelect,
    }),
    [abort, agent, messages, onSubmit, streaming, tokenUsage, resumeRequest, handleResumeSelect],
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
 * Extract the last user question and the last assistant reply from
 * the restored messages. Shows where the user left off.
 */
function getLastCompleteTurn(messages: NonSystemMessage[]): NonSystemMessage[] {
  // Find the last user message
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) return messages.slice(-2);

  // Return the last user message and everything after it (the assistant's response)
  return messages.slice(lastUserIdx);
}
