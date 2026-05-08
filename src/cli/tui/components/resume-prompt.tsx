import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

import type { SessionInfo } from "@/agent/transcript";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

export function ResumePrompt({
  sessions,
  onSelect,
}: {
  sessions: SessionInfo[];
  onSelect: (session: SessionInfo | null) => void;
}) {
  const options = [...sessions.map((s) => ({ type: "session" as const, session: s })), { type: "cancel" as const }];
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setIndex((i) => (i > 0 ? i - 1 : options.length - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => (i < options.length - 1 ? i + 1 : 0));
      return;
    }
    if (key.return) {
      const selected = options[index]!;
      if (selected.type === "cancel") {
        onSelect(null);
      } else {
        onSelect(selected.session);
      }
      return;
    }
    if (key.escape) {
      onSelect(null);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>Resume a previous session:</Text>
      <Box marginTop={1} flexDirection="column">
        {options.map((opt, i) => {
          const marker = i === index ? ">" : " ";
          const color = i === index ? "cyan" : undefined;
          if (opt.type === "cancel") {
            return (
              <Text key="cancel" color={color}>
                {marker} [Cancel]
              </Text>
            );
          }
          return (
            <Text key={opt.session.id} color={color}>
              {marker} {formatDate(opt.session.mtime)} ({opt.session.messageCount} messages)
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Up/Down to move, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
