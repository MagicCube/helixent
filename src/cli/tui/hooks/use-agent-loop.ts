import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { NonSystemMessage, UserMessage } from "@/foundation";

import type { PromptSubmission } from "../command-registry";
import { resolveBuiltinCommand } from "../command-registry";

const AgentLoopContext = createContext<Agent | null>(null);

export function AgentLoopProvider({ agent, children }: { agent: Agent; children: ReactNode }) {
  const value = useMemo(() => agent, [agent]);
  return createElement(AgentLoopContext.Provider, { value }, children);
}

function useAgent(): Agent {
  const agent = useContext(AgentLoopContext);
  if (!agent) {
    throw new Error("useAgentLoop() must be used within <AgentLoopProvider agent={...}>");
  }
  return agent;
}

export function useAgentLoop() {
  const agent = useAgent();

  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);

  const streamingRef = useRef(streaming);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  const abort = useCallback(() => {
    agent.abort();
  }, [agent]);

  const onSubmit = useCallback(
    async (submission: PromptSubmission) => {
      const { text, requestedSkillName } = submission;
      const builtinCommand = resolveBuiltinCommand(text);

      if (builtinCommand === "exit" || builtinCommand === "quit") {
        process.exit(0);
        return;
      }

      if (streamingRef.current) return;

      if (builtinCommand === "clear") {
        setMessages([]);
        return;
      }

      setStreaming(true);

      try {
        agent.setRequestedSkillName(requestedSkillName);
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => [...prev, userMessage]);

        const stream = agent.stream(userMessage);
        for await (const message of stream) {
          setMessages((prev) => [...prev, message]);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        throw error;
      } finally {
        agent.setRequestedSkillName(null);
        setStreaming(false);
      }
    },
    [agent],
  );

  return { agent, streaming, messages, onSubmit, abort };
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  // OpenAI SDK throws APIUserAbortError
  if (error instanceof Error && error.constructor.name === "APIUserAbortError") return true;
  return false;
}
