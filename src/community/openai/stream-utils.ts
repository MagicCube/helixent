import type { AssistantMessage, AssistantMessageContent, TokenUsage } from "@/foundation";

import { getReasoningContent, type OpenAIChatCompletionChunk } from "./types";

function toTokenUsage(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}) {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

export class StreamAccumulator {
  private reasoningContent = "";
  private textContent = "";
  private toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  private usage: TokenUsage | undefined;
  private finished = false;
  private seenChunk = false;

  push(chunk: OpenAIChatCompletionChunk): void {
    this.seenChunk = true;
    const delta = chunk.choices[0]?.delta;

    if (delta) {
      // Reasoning / thinking content
      const reasoning = getReasoningContent(delta);
      if (reasoning) {
        this.reasoningContent += reasoning;
      }

      // Text content
      if (typeof delta.content === "string") {
        this.textContent += delta.content;
      }

      // Tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          let entry = this.toolCalls.get(tc.index);
          if (!entry) {
            entry = { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: "" };
            this.toolCalls.set(tc.index, entry);
          }
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }
    }

    // Usage is optional metadata. When present it arrives on the final OpenAI
    // chunk, so preserve the existing behavior of treating that snapshot as final.
    if (chunk.usage) {
      this.usage = toTokenUsage(chunk.usage);
      this.finished = true;
    }
  }

  /**
   * Marks the accumulator complete when the provider iterator ends without an
   * OpenAI usage chunk. Returns true when this call changed the final state.
   * Empty iterators remain empty so downstream no-message safeguards still fire.
   */
  finish(): boolean {
    if (!this.seenChunk || this.finished) return false;
    this.finished = true;
    return true;
  }

  snapshot(): AssistantMessage {
    const content: AssistantMessageContent = [];

    if (this.reasoningContent) {
      content.push({ type: "thinking", thinking: this.reasoningContent });
    }
    if (this.textContent) {
      content.push({ type: "text", text: this.textContent });
    }

    // Sort by index to preserve order
    const sorted = [...this.toolCalls.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, tc] of sorted) {
      let input: Record<string, unknown> = {};
      let parsed = false;
      try {
        input = JSON.parse(tc.arguments);
        parsed = true;
      } catch {
        // arguments JSON is still streaming — fall through
      }
      // During streaming snapshots we intentionally withhold a tool_use entry
      // until its arguments parse successfully, so downstream consumers never
      // observe a half-formed payload. Once the iterator is finished, retain the
      // previous best-effort fallback to an empty input object.
      if (!parsed && !this.finished) continue;
      content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
    }

    return {
      role: "assistant",
      content,
      usage: this.usage,
      ...(this.finished ? {} : { streaming: true }),
    };
  }
}
