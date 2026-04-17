import type { StructuredToolError, StructuredToolResult, StructuredToolSuccess } from "@/foundation";

import { compactTranscriptPayload } from "./tool-compaction";
import { getToolResultPolicy } from "./tool-result-policy";

export type ToolErrorKind =
  | "invalid_input"
  | "unsupported"
  | "not_found"
  | "environment_missing"
  | "execution_failed"
  | "unknown";

export type NormalizedToolSuccess = StructuredToolSuccess & {
  raw: unknown;
};

export type NormalizedToolError = StructuredToolError & {
  errorKind: ToolErrorKind;
  raw: unknown;
};

export type NormalizedToolResult = NormalizedToolSuccess | NormalizedToolError;

export type ToolResultEnvelope = {
  normalized: NormalizedToolResult;
  transcript: string;
};

export function inferToolErrorKind(code?: string): ToolErrorKind {
  if (!code) return "unknown";
  if (code.startsWith("INVALID_")) return "invalid_input";
  if (code.endsWith("_NOT_SUPPORTED")) return "unsupported";
  if (code === "RG_NOT_FOUND") return "environment_missing";
  if (code === "FILE_NOT_FOUND" || code.endsWith("_NOT_FOUND")) return "not_found";
  if (code.endsWith("_FAILED")) return "execution_failed";
  return "unknown";
}

function isStructuredToolSuccess(value: unknown): value is StructuredToolSuccess {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true &&
    "summary" in value &&
    typeof value.summary === "string"
  );
}

function isStructuredToolError(value: unknown): value is StructuredToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === false &&
    "summary" in value &&
    typeof value.summary === "string" &&
    "error" in value &&
    typeof value.error === "string"
  );
}

export function normalizeToolResult(result: unknown): NormalizedToolResult {
  if (isStructuredToolSuccess(result)) {
    return {
      ok: true,
      summary: result.summary,
      ...(result.data !== undefined ? { data: result.data } : {}),
      raw: result,
    };
  }

  if (isStructuredToolError(result)) {
    return {
      ok: false,
      summary: result.summary,
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.details ? { details: result.details } : {}),
      errorKind: inferToolErrorKind(result.code),
      raw: result,
    };
  }

  if (typeof result === "string" && result.startsWith("Error:")) {
    const error = result.slice("Error:".length).trim() || "Tool execution failed.";
    return {
      ok: false,
      summary: error,
      error,
      errorKind: "unknown",
      raw: result,
    };
  }

  const summary = stringifyValue(result);
  return {
    ok: true,
    summary,
    ...(result !== undefined ? { data: result } : {}),
    raw: result,
  };
}

export function buildToolResultEnvelope({ toolName, result }: { toolName: string; result: unknown }): ToolResultEnvelope {
  if (toolName === "read_file" && typeof result === "string") {
    return {
      normalized: {
        ok: true,
        summary: truncateSummary(result),
        data: result,
        raw: result,
      },
      transcript: result,
    };
  }

  const normalized = normalizeToolResult(result);
  const policy = getToolResultPolicy(toolName);

  const compacted = compactTranscriptPayload({ toolName, normalized, policy });

  return {
    normalized,
    transcript: stringifyWithinLimit(
      compacted,
      policy.maxStringLength,
      compacted.ok
        ? {
          ok: true,
          summary: truncateSummary(compacted.summary),
        }
        : {
          ok: false,
          summary: truncateSummary(compacted.summary),
          error: truncateSummary(compacted.error),
          ...(compacted.code ? { code: compacted.code } : {}),
        },
    ),
  };
}

export function formatToolResultForMessage({ toolName, result }: { toolName: string; result: unknown }): string {
  return buildToolResultEnvelope({ toolName, result }).transcript;
}

function stringifyValue(value: unknown) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable object]";
    }
  }
  return String(value);
}

function stringifyWithinLimit(payload: StructuredToolResult, maxLength: number | undefined, fallback: StructuredToolResult): string {
  const serialized = JSON.stringify(payload);
  if (!maxLength || serialized.length <= maxLength) {
    return serialized;
  }

  const fallbackSerialized = JSON.stringify(fallback);
  if (!maxLength || fallbackSerialized.length <= maxLength) {
    return fallbackSerialized;
  }

  if (fallback.ok) {
    return JSON.stringify({ ok: true, summary: fallback.summary.slice(0, Math.max(0, maxLength - 32)) } satisfies StructuredToolResult);
  }

  return JSON.stringify({
    ok: false,
    summary: fallback.summary.slice(0, Math.max(0, maxLength - 64)),
    error: fallback.error.slice(0, Math.max(0, maxLength - 64)),
    ...(fallback.code ? { code: fallback.code } : {}),
  } satisfies StructuredToolResult);
}

function truncateSummary(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
}
