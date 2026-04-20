import { Box, Text } from "ink";

import { useAgentLoop } from "../hooks/use-agent-loop";
import { currentTheme } from "../themes";

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

export function Footer() {
  const { agent, sessionId, tokenCount } = useAgentLoop();
  return (
    <Box paddingX={2} width="100%">
      <Box flexGrow={1} justifyContent="flex-start">
        <Text color={currentTheme.colors.dimText}>{agent.model.name}</Text>
      </Box>
      <Box justifyContent="flex-end" columnGap={2}>
        <Text color={currentTheme.colors.dimText}>session {sessionId}</Text>
        <Text color={currentTheme.colors.dimText}>{formatTokenCount(tokenCount)} tokens</Text>
      </Box>
    </Box>
  );
}
