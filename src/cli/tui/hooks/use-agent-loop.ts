import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import { generateSessionId, saveSession } from "@/cli/sessions";
import type { AssistantMessage, NonSystemMessage, UserMessage } from "@/foundation";

import type { PromptSubmission, SlashCommand } from "../command-registry";
import { formatHelp, resolveBuiltinCommand } from "../command-registry";

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  sessionId: string;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (submission: PromptSubmission) => Promise<void>;
  abort: () => void;
  tokenCount: number;
};

const AgentLoopContext = createContext<AgentLoopState | null>(null);

export function AgentLoopProvider({
  agent,
  commands = [],
  sessionId: initialSessionId,
  sessionCreatedAt: initialSessionCreatedAt,
  initialMessages = [],
  children,
}: {
  agent: Agent;
  commands?: SlashCommand[];
  /** Session ID to persist the conversation under. A new one is generated if omitted. */
  sessionId?: string;
  /** Original createdAt of the session; preserved across saves when resuming. */
  sessionCreatedAt?: string;
  /** Pre-populated messages when resuming a saved session. */
  initialMessages?: NonSystemMessage[];
  children: ReactNode;
}) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>(initialMessages);
  const sessionIdRef = useRef(initialSessionId ?? generateSessionId());
  const sessionCreatedAtRef = useRef(initialSessionCreatedAt ?? new Date().toISOString());
  const messagesRef = useRef<NonSystemMessage[]>(initialMessages);

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
    setMessages((prev) => {
      const next = [...prev, ...pending];
      messagesRef.current = next;
      return next;
    });
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
        messagesRef.current = [];
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

      setStreaming(true);

      try {
        agent.setRequestedSkillName(requestedSkillName);
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => {
          const next = [...prev, userMessage];
          messagesRef.current = next;
          return next;
        });

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
        throw error;
      } finally {
        agent.setRequestedSkillName(null);
        flushPendingMessages();
        setStreaming(false);
        try {
          saveSession({
            id: sessionIdRef.current,
            createdAt: sessionCreatedAtRef.current,
            updatedAt: new Date().toISOString(),
            cwd: process.cwd(),
            messages: messagesRef.current,
          });
        } catch {
          // session save is best-effort; never crash the TUI
        }
      }
    },
    [agent, commands, enqueueMessage, flushPendingMessages],
  );

  const value = useMemo(
    () => ({
      agent,
      streaming,
      messages,
      sessionId: sessionIdRef.current,
      onSubmit,
      abort,
      tokenCount,
    }),
    [abort, agent, messages, onSubmit, streaming, tokenCount],
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
