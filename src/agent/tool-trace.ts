import type { ToolErrorKind } from "./tool-result-runtime";

export type ToolTraceRecord = {
  step: number;
  toolName: string;
  toolUseId: string;
  inputSignature: string;
  ok: boolean;
  summary: string;
  code?: string;
  errorKind?: ToolErrorKind;
  repeatedFailure: boolean;
};

export type ToolTraceState = {
  recent: ToolTraceRecord[];
  repeatedFailureCount: number;
};

export function createToolTraceState(): ToolTraceState {
  return {
    recent: [],
    repeatedFailureCount: 0,
  };
}

export function createToolInputSignature(input: unknown): string {
  if (input === undefined) return "undefined";
  try {
    return JSON.stringify(input);
  } catch {
    return "[unserializable input]";
  }
}

export function appendToolTrace(
  state: ToolTraceState,
  record: Omit<ToolTraceRecord, "repeatedFailure">,
  windowSize = 12,
): ToolTraceRecord {
  const repeatedFailure = !record.ok && state.recent.some((entry) => (
    !entry.ok
    && entry.toolName === record.toolName
    && entry.inputSignature === record.inputSignature
    && entry.code === record.code
    && entry.errorKind === record.errorKind
  ));

  const next: ToolTraceRecord = {
    ...record,
    repeatedFailure,
  };

  state.recent.push(next);
  if (state.recent.length > windowSize) {
    state.recent.splice(0, state.recent.length - windowSize);
  }
  if (repeatedFailure) {
    state.repeatedFailureCount += 1;
  }
  return next;
}

export function summarizeRecentToolTrace(state: ToolTraceState, maxEntries = 3) {
  const entries = state.recent.slice(-maxEntries);
  return {
    totalRecent: state.recent.length,
    repeatedFailureCount: state.repeatedFailureCount,
    latestFailures: entries.filter((entry) => !entry.ok).map((entry) => ({
      toolName: entry.toolName,
      summary: entry.summary,
      ...(entry.code ? { code: entry.code } : {}),
      ...(entry.errorKind ? { errorKind: entry.errorKind } : {}),
      repeatedFailure: entry.repeatedFailure,
    })),
  };
}
