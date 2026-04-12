import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { AssistantMessage, NonSystemMessage, UserMessage } from "@/foundation";

import type { PromptSubmission, SlashCommand } from "../command-registry";
import { formatHelp, resolveBuiltinCommand } from "../command-registry";

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  streamingText: string;
  printMode: boolean;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (submission: PromptSubmission) => Promise<void>;
  abort: () => void;
  tokenCount: number;
};

const AgentLoopContext = createContext<AgentLoopState | null>(null);

export function AgentLoopProvider({
  agent,
  commands = [],
  printMode = false,
  children,
}: {
  agent: Agent;
  commands?: SlashCommand[];
  printMode?: boolean;
  children: ReactNode;
}) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");

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

      setStreaming(true);
      setStreamingText("");

      try {
        agent.setRequestedSkillName(requestedSkillName);
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => [...prev, userMessage]);

        const stream = agent.stream(userMessage);
        for await (const event of stream) {
          if (event.type === "message") {
            // Clear streaming text when a completed message arrives
            setStreamingText("");
            enqueueMessage(event.message);
          } else if (event.type === "progress" && event.subtype === "thinking") {
            if (printMode) {
              // Print Mode: write delta directly to stdout for instant output
              if (event.delta) {
                process.stdout.write(event.delta);
              }
            } else {
              // Ink Mode: update React state for re-rendering
              setStreamingText(event.text);
            }
          }
          // tool progress events are handled by StreamingIndicator
        }

        if (printMode) {
          // Ensure a newline after print-mode streaming completes
          process.stdout.write("\n");
        }
      } catch (error) {
        if (isAbortError(error)) return;
        throw error;
      } finally {
        agent.setRequestedSkillName(null);
        flushPendingMessages();
        setStreamingText("");
        setStreaming(false);
      }
    },
    [agent, commands, enqueueMessage, flushPendingMessages, printMode],
  );

  const value = useMemo(
    () => ({
      agent,
      streaming,
      messages,
      streamingText,
      printMode,
      onSubmit,
      abort,
      tokenCount,
    }),
    [abort, agent, messages, onSubmit, streaming, streamingText, printMode, tokenCount],
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
