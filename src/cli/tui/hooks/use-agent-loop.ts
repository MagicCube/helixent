import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { AssistantMessage, NonSystemMessage, UserMessage } from "@/foundation";

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  // eslint-disable-next-line no-unused-vars
  onSubmit: (...args: [string]) => Promise<void>;
  abort: () => void;
  tokenCount: number;
};

const AgentLoopContext = createContext<AgentLoopState | null>(null);

export function AgentLoopProvider({ agent, children }: { agent: Agent; children: ReactNode }) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);

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

  const onSubmit = useCallback(
    async (text: string) => {
      if (text === "exit" || text === "quit" || text === "/exit" || text === "/quit") {
        process.exit(0);
        return;
      }

      if (streamingRef.current) return;

      if (text === "/clear") {
        agent.clearMessages();
        flushPendingMessages();
        setMessages([]);
        clearTerminal();
        return;
      }

      setStreaming(true);

      try {
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => [...prev, userMessage]);

        const stream = agent.stream(userMessage);
        for await (const message of stream) {
          enqueueMessage(message);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        throw error;
      } finally {
        flushPendingMessages();
        setStreaming(false);
      }
    },
    [agent, enqueueMessage, flushPendingMessages],
  );

  const value = useMemo(
    () => ({
      agent,
      streaming,
      messages,
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
  // OpenAI SDK throws APIUserAbortError
  if (error instanceof Error && error.constructor.name === "APIUserAbortError") return true;
  return false;
}

function clearTerminal() {
  if (!process.stdout.isTTY) return;
  process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
}
