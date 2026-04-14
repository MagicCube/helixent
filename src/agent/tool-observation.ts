import type { ToolTraceRecord, ToolTraceState } from "./tool-trace";
import { summarizeRecentToolTrace } from "./tool-trace";

import type { ToolRecoveryHint } from "./tool-recovery-policy";

function formatFailureLine(record: ToolTraceRecord, recoveryHint?: ToolRecoveryHint | null) {
  const parts = [
    `- step ${record.step}`,
    `tool=${record.toolName}`,
    `summary=${JSON.stringify(record.summary)}`,
  ];

  if (record.code) {
    parts.push(`code=${record.code}`);
  }
  if (record.errorKind) {
    parts.push(`kind=${record.errorKind}`);
  }
  if (record.repeatedFailure) {
    parts.push("repeated_failure=true");
  }
  if (recoveryHint?.shouldSuppressImmediateRetry) {
    parts.push("avoid_immediate_retry=true");
  }
  if (recoveryHint?.suggestedTools?.length) {
    parts.push(`suggested_tools=${recoveryHint.suggestedTools.join(",")}`);
  }

  return parts.join(" ");
}

function dedupeFailureRecords(records: ToolTraceRecord[]) {
  const seen = new Set<string>();
  const result: ToolTraceRecord[] = [];

  for (const record of records) {
    const key = [record.toolName, record.inputSignature, record.code ?? "", record.errorKind ?? "", record.summary].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(record);
  }

  return result;
}

export function buildRecentToolObservation(params: {
  state: ToolTraceState;
  getRecoveryHint: (record: ToolTraceRecord) => ToolRecoveryHint | null;
  maxFailures?: number;
}) {
  const { state, getRecoveryHint, maxFailures = 3 } = params;

  const recentFailures = state.recent.filter((record) => !record.ok);
  if (recentFailures.length === 0) {
    return null;
  }

  const prioritized = dedupeFailureRecords(
    [...recentFailures].sort((a, b) => {
      const repeatedDiff = Number(b.repeatedFailure) - Number(a.repeatedFailure);
      if (repeatedDiff !== 0) {
        return repeatedDiff;
      }

      const suppressRetryDiff = Number(Boolean(getRecoveryHint(b)?.shouldSuppressImmediateRetry))
        - Number(Boolean(getRecoveryHint(a)?.shouldSuppressImmediateRetry));
      if (suppressRetryDiff !== 0) {
        return suppressRetryDiff;
      }

      return b.step - a.step;
    }),
  ).slice(0, maxFailures);

  // Build a compact header with aggregated signals to nudge planning:
  // - total recent failures
  // - repeated failure count (same tool/input/code/kind)
  // - tools to avoid immediate retry (from hints or repeated failure)
  const summary = summarizeRecentToolTrace(state, maxFailures);
  const avoidImmediateRetryTools = Array.from(new Set(
    prioritized
      .filter((r) => r.repeatedFailure || getRecoveryHint(r)?.shouldSuppressImmediateRetry)
      .map((r) => r.toolName),
  ));

  const header = [
    `summary: recent_failures=${recentFailures.length}`,
    `repeated_failures=${summary.repeatedFailureCount}`,
    `avoid_immediate_retry_tools=${avoidImmediateRetryTools.length ? avoidImmediateRetryTools.join(",") : "-"}`,
  ].join(" ");

  const lines = prioritized.map((record) => formatFailureLine(record, getRecoveryHint(record)));

  return [
    "<tool_observation>",
    "Recent tool failures were observed. Use this to plan the next action, and avoid blindly repeating the same failed call.",
    header,
    ...lines,
    "</tool_observation>",
  ].join("\n");
}
