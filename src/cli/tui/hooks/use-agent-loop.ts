import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Agent } from "@/agent";
import type { ModelEntry } from "@/cli/config";
import type { AssistantMessage, Model, NonSystemMessage, UserMessage } from "@/foundation";

import type { PromptSubmission, SlashCommand } from "../command-registry";
import { formatHelp, resolveBuiltinCommand } from "../command-registry";
import { resolveModelSelection } from "../model-command";
import { calculateTokenUsage, type TokenUsageSummary } from "../token-usage";

export type ModelSelectionOptions = {
  models: ModelEntry[];
  defaultModelName?: string;
  // eslint-disable-next-line no-unused-vars
  buildModel: (entry: ModelEntry) => Model;
};

export type ModelPickerState = {
  models: ModelEntry[];
  currentModelName: string;
  defaultModelName?: string;
};

type AgentLoopState = {
  agent: Agent;
  streaming: boolean;
  messages: NonSystemMessage[];
  // eslint-disable-next-line no-unused-vars
  onSubmit: (submission: PromptSubmission) => Promise<void>;
  abort: () => void;
  tokenUsage: TokenUsageSummary;
  modelPicker: ModelPickerState | null;
  // eslint-disable-next-line no-unused-vars
  selectModel: (modelName: string) => void;
  cancelModelSelection: () => void;
};

const AgentLoopContext = createContext<AgentLoopState | null>(null);

export function AgentLoopProvider({
  agent,
  commands = [],
  modelSelection,
  children,
}: {
  agent: Agent;
  commands?: SlashCommand[];
  modelSelection?: ModelSelectionOptions;
  children: ReactNode;
}) {
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<NonSystemMessage[]>([]);
  const [modelPicker, setModelPicker] = useState<ModelPickerState | null>(null);

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

  const appendAssistantText = useCallback((text: string) => {
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text }],
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }, []);

  const selectModel = useCallback(
    (modelName: string) => {
      const message = handleModelCommand(agent, modelSelection, modelName);
      setModelPicker(null);
      appendAssistantText(message);
    },
    [agent, appendAssistantText, modelSelection],
  );

  const cancelModelSelection = useCallback(() => {
    setModelPicker(null);
  }, []);

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

      if (invocation?.name === "model") {
        flushPendingMessages();
        const userMessage: UserMessage = { role: "user", content: [{ type: "text", text }] };
        if (!invocation.args && modelSelection && modelSelection.models.length > 0) {
          setMessages((prev) => [...prev, userMessage]);
          setModelPicker({
            models: modelSelection.models,
            currentModelName: agent.model.name,
            defaultModelName: modelSelection.defaultModelName,
          });
          return;
        }

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: [{ type: "text", text: handleModelCommand(agent, modelSelection, invocation.args) }],
        };
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
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
    [agent, commands, enqueueMessage, flushPendingMessages, modelSelection],
  );

  const value = useMemo(
    () => ({
      agent,
      streaming,
      messages,
      onSubmit,
      abort,
      tokenUsage,
      modelPicker,
      selectModel,
      cancelModelSelection,
    }),
    [abort, agent, cancelModelSelection, messages, modelPicker, onSubmit, selectModel, streaming, tokenUsage],
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

function handleModelCommand(
  agent: Agent,
  modelSelection: ModelSelectionOptions | undefined,
  args: string,
): string {
  if (!modelSelection) {
    return "Model selection is unavailable in this session.";
  }

  const selection = resolveModelSelection({
    models: modelSelection.models,
    currentModelName: agent.model.name,
    targetName: args,
  });
  if (!selection.ok) {
    return selection.message;
  }

  agent.setModel(modelSelection.buildModel(selection.entry));
  return selection.message;
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
