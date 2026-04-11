import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import type { ApprovalDecision } from "@/coding";
import type { ToolUseContent } from "@/foundation";

const ALL_OPTIONS: readonly {
  decision: ApprovalDecision;
  label: string;
  shortcut: string;
  color: "green" | "red";
}[] = [
  { decision: "allow_once", label: "Yes — this time only", shortcut: "y", color: "green" },
  {
    decision: "allow_always_project",
    label: "Yes, always allow in this project",
    shortcut: "a",
    color: "green",
  },
  { decision: "deny", label: "No", shortcut: "n", color: "red" },
];

export function ApprovalPrompt({
  toolUse,
  supportProjectWideAllow = false,
  onDecision,
}: {
  toolUse: ToolUseContent;
  supportProjectWideAllow?: boolean;
  // eslint-disable-next-line no-unused-vars
  onDecision: (decision: ApprovalDecision) => void;
}) {
  const options = useMemo(
    () =>
      supportProjectWideAllow
        ? ALL_OPTIONS
        : ALL_OPTIONS.filter((o) => o.decision !== "allow_always_project"),
    [supportProjectWideAllow],
  );

  const [index, setIndex] = useState(0);

  const shortcutHint = supportProjectWideAllow ? "y / a / n or 1 / 2 / 3" : "y / n or 1 / 2";

  useInput((input, key) => {
    if (key.upArrow) {
      setIndex((i) => (i > 0 ? i - 1 : options.length - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => (i < options.length - 1 ? i + 1 : 0));
      return;
    }
    if (key.return) {
      onDecision(options[index]!.decision);
      return;
    }
    const k = input.toLowerCase();
    if (k === "y" || input === "1") {
      onDecision("allow_once");
    } else if (supportProjectWideAllow && (k === "a" || input === "2")) {
      onDecision("allow_always_project");
    } else if (supportProjectWideAllow && (k === "n" || input === "3")) {
      onDecision("deny");
    } else if (!supportProjectWideAllow && (k === "n" || input === "2")) {
      onDecision("deny");
    }
  });

  const argsStr = JSON.stringify(toolUse.input, null, 2);
  const displayArgs = argsStr.length > 500 ? argsStr.slice(0, 500) + "\n... (truncated)" : argsStr;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>
        ⚠️ Agent wants to run a high-risk tool: <Text color="white">{toolUse.name}</Text>
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{displayArgs}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Allow execution?</Text>
        <Text dimColor>↑/↓ to move · Enter to confirm · shortcuts: {shortcutHint}</Text>
        {options.map((opt, i) => (
          <Text key={opt.decision} color={i === index ? "cyan" : undefined}>
            {i === index ? "❯ " : "  "}
            <Text color={opt.color}>[{opt.shortcut}]</Text> {opt.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
