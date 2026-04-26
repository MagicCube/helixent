import type Anthropic from "@anthropic-ai/sdk";

import type { AssistantMessage, AssistantMessageContent, TokenUsage } from "@/foundation";

/**
 * Accumulated state for a single content block while streaming.
 * The `type` discriminator is fixed when the block starts; fields are filled
 * in progressively as deltas arrive.
 */
type BlockState =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; partialJson: string };

/**
 * Accumulates Anthropic stream events into progressively more complete
 * {@link AssistantMessage} snapshots.
 *
 * Anthropic's streaming protocol emits a sequence of events:
 * - `message_start` — carries initial usage (input tokens only).
 * - `content_block_start` — opens a block at a given index (text, thinking, or tool_use).
 * - `content_block_delta` — appends to the current block (text, thinking, input JSON, or signature).
 * - `content_block_stop` — closes the block.
 * - `message_delta` — carries final usage (output tokens) on the last event.
 */
export class StreamAccumulator {
  private readonly blocks = new Map<number, BlockState>();
  private inputTokens = 0;
  private outputTokens = 0;
  private hasFinalUsage = false;

  push(event: Anthropic.RawMessageStreamEvent): void {
    switch (event.type) {
      case "message_start":
        this.inputTokens = event.message.usage.input_tokens ?? 0;
        this.outputTokens = event.message.usage.output_tokens ?? 0;
        return;
      case "content_block_start":
        this._handleBlockStart(event);
        return;
      case "content_block_delta":
        this._handleBlockDelta(event);
        return;
      case "message_delta":
        this._handleMessageDelta(event);
        return;
      // content_block_stop and message_stop carry no data we need.
      default:
        return;
    }
  }

  snapshot(): AssistantMessage {
    const content: AssistantMessageContent = [];
    // Preserve the Anthropic block order by index.
    const ordered = [...this.blocks.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, block] of ordered) {
      const item = blockToContent(block);
      if (item) content.push(item);
    }

    return {
      role: "assistant",
      content,
      usage: this.hasFinalUsage ? this._buildUsage() : undefined,
      ...(this.hasFinalUsage ? {} : { streaming: true }),
    };
  }

  private _handleBlockStart(event: Anthropic.RawContentBlockStartEvent): void {
    const { index, content_block } = event;
    if (content_block.type === "text") {
      this.blocks.set(index, { type: "text", text: content_block.text });
    } else if (content_block.type === "thinking") {
      this.blocks.set(index, {
        type: "thinking",
        thinking: content_block.thinking,
        ...(content_block.signature ? { signature: content_block.signature } : {}),
      });
    } else if (content_block.type === "tool_use") {
      this.blocks.set(index, {
        type: "tool_use",
        id: content_block.id,
        name: content_block.name,
        partialJson: "",
      });
    }
  }

  private _handleBlockDelta(event: Anthropic.RawContentBlockDeltaEvent): void {
    const block = this.blocks.get(event.index);
    if (!block) return;
    const delta = event.delta;
    if (delta.type === "text_delta" && block.type === "text") {
      block.text += delta.text;
    } else if (delta.type === "thinking_delta" && block.type === "thinking") {
      block.thinking += delta.thinking;
    } else if (delta.type === "signature_delta" && block.type === "thinking") {
      block.signature = delta.signature;
    } else if (delta.type === "input_json_delta" && block.type === "tool_use") {
      block.partialJson += delta.partial_json;
    }
  }

  private _handleMessageDelta(event: Anthropic.RawMessageDeltaEvent): void {
    // Final usage — output tokens are cumulative on this event.
    if (event.usage.output_tokens != null) {
      this.outputTokens = event.usage.output_tokens;
    }
    if (event.usage.input_tokens != null) {
      this.inputTokens = event.usage.input_tokens;
    }
    this.hasFinalUsage = true;
  }

  private _buildUsage(): TokenUsage {
    return {
      promptTokens: this.inputTokens,
      completionTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
    };
  }
}

/**
 * Converts a single accumulated block into its {@link AssistantMessageContent}
 * representation, or returns null when the block carries no renderable payload yet
 * (e.g. a text block that hasn't received any deltas).
 */
function blockToContent(block: BlockState): AssistantMessageContent[number] | null {
  if (block.type === "text") {
    return block.text ? { type: "text", text: block.text } : null;
  }
  if (block.type === "thinking") {
    const thinkingContent: Record<string, unknown> = {
      type: "thinking",
      thinking: block.thinking,
    };
    if (block.signature) {
      // Preserve the signature so it can be sent back in multi-turn conversations.
      thinkingContent._anthropicSignature = block.signature;
    }
    return thinkingContent as never;
  }
  // tool_use
  return { type: "tool_use", id: block.id, name: block.name, input: parseToolInput(block.partialJson) };
}

function parseToolInput(partialJson: string): Record<string, unknown> {
  if (!partialJson) return {};
  try {
    return JSON.parse(partialJson);
  } catch {
    // Input JSON is still incomplete — yield empty input until it finishes.
    return {};
  }
}
