import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { NonSystemMessage, UserMessage } from "@/foundation";

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

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);

  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const onSubmit = useCallback(
    async (text: string) => {
      if (text === "exit" || text === "quit" || text === "/exit" || text === "/quit") {
        process.exit(0);
        return;
      }

      if (text === "/clear") {
        setMessages([]);
        return;
      }

      if (loadingRef.current) return;
      setLoading(true);

      try {
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        setMessages((prev) => [...prev, userMessage]);

        const stream = await agent.stream(userMessage);
        for await (const message of stream) {
          setMessages((prev) => [...prev, message]);
        }
      } finally {
        setLoading(false);
      }
    },
    [agent],
  );

  return { agent, loading, messages, onSubmit };
}
