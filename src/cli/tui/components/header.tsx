import { Box, Text } from "ink";

import packageJson from "../../../../package.json";
import { useAgentLoop } from "../hooks/use-agent-loop";
import { currentTheme } from "../themes";

export function Header() {
  const { agent } = useAgentLoop();
  return (
    <Box columnGap={2}>
      <Logo />
      <Box flexDirection="column">
        <Box columnGap={1}>
          <Text color={currentTheme.colors.primary}>Helixent</Text>
          <Text color={currentTheme.colors.dimText}>v{packageJson.version}</Text>
        </Box>
        <Box>
          <Text color={currentTheme.colors.dimText}>{agent.model.name}</Text>
        </Box>
        <Box columnGap={1}>
          <Text color={currentTheme.colors.dimText}>{process.cwd()}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function Logo({ color = currentTheme.colors.primary }: { color?: string }) {
  return (
    <Box flexDirection="column">
      <Text color={color}>{" ".repeat(2)}▋▋ ▋▋</Text>
      <Text color={color}> ▐▛███▜▌</Text>
      <Text color={color}>▝▜█████▛▘</Text>
    </Box>
  );
}
