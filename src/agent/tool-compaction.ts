import type { StructuredToolResult } from "@/foundation";

import type { ToolResultPolicy } from "./tool-result-policy";
import type { NormalizedToolError, NormalizedToolResult, NormalizedToolSuccess } from "./tool-result-runtime";

function truncateString(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }
  return {
    value: `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`,
    truncated: true,
  };
}

function compactValue(value: unknown, maxItems: number, maxTextLength: number): unknown {
  if (typeof value === "string") {
    return truncateString(value, maxTextLength).value;
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, maxItems).map((item) => compactValue(item, maxItems, maxTextLength));
    return value.length > maxItems
      ? {
        items,
        truncated: true,
        originalLength: value.length,
      }
      : items;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, compactValue(entryValue, maxItems, maxTextLength)]));
  }

  return value;
}

export function compactToolResultData(params: {
  toolName: string;
  normalized: NormalizedToolResult;
  policy: ToolResultPolicy;
}): StructuredToolResult {
  const { normalized, policy } = params;
  const maxItems = policy.maxDataItems ?? 20;
  const maxTextLength = policy.maxDataTextLength ?? 1000;

  if (!normalized.ok) {
    const errorResult: StructuredToolResult = {
      ok: false,
      summary: truncateString(normalized.summary, maxTextLength).value,
      error: truncateString(normalized.error, maxTextLength).value,
      ...(normalized.code ? { code: normalized.code } : {}),
      ...(normalized.details ? { details: compactValue(normalized.details, maxItems, maxTextLength) as Record<string, unknown> } : {}),
    };
    return errorResult;
  }

  const success = normalized as NormalizedToolSuccess;
  return {
    ok: true,
    summary: truncateString(success.summary, maxTextLength).value,
    ...(success.data !== undefined ? { data: compactValue(success.data, maxItems, maxTextLength) } : {}),
  };
}

export function compactTranscriptPayload(params: {
  toolName: string;
  normalized: NormalizedToolResult;
  policy: ToolResultPolicy;
}): StructuredToolResult {
  const compacted = compactToolResultData(params);

  if (!params.normalized.ok) {
    return compacted;
  }

  if (params.policy.preferSummaryOnly || !params.policy.includeData) {
    return {
      ok: true,
      summary: compacted.summary,
    };
  }

  return compacted;
}

export function compactErrorForHint(normalized: NormalizedToolError, maxTextLength = 240) {
  return {
    summary: truncateString(normalized.summary, maxTextLength).value,
    error: truncateString(normalized.error, maxTextLength).value,
    ...(normalized.code ? { code: normalized.code } : {}),
  };
}
