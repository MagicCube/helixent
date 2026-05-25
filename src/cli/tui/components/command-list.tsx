import { Box, Text } from "ink";

import type { SlashCommand } from "../command-registry";
import { currentTheme } from "../themes";

const MAX_VISIBLE_COMMANDS = 5;

interface CommandListProps {
  commands: SlashCommand[];
  selectedIndex: number;
}

export function CommandList({ commands, selectedIndex }: CommandListProps) {
  if (commands.length === 0) {
    return (
      <Box paddingX={2}>
        <Text dimColor>No commands found</Text>
      </Box>
    );
  }

  const { endIndex, startIndex } = getVisibleWindow(commands.length, selectedIndex, MAX_VISIBLE_COMMANDS);
  const visibleCommands = commands.slice(startIndex, endIndex);
  const commandColumnWidth = getCommandColumnWidth(commands);
  return (
    <Box
      flexDirection="column"
      width="100%"
      borderStyle="single"
      borderColor={currentTheme.colors.borderColor}
      paddingX={1}
      marginTop={0}
    >
      <Text bold color={currentTheme.colors.primary}>
        Commands
      </Text>
      {visibleCommands.map((cmd, visibleIndex) => {
        const index = startIndex + visibleIndex;
        return (
          <Box key={cmd.name} flexDirection="row">
            <Box flexShrink={0} width={commandColumnWidth}>
              <Text
                color={index === selectedIndex ? currentTheme.colors.highlightedText : undefined}
                bold={index === selectedIndex}
              >
                {index === selectedIndex ? "❯ " : "  "}/{cmd.name}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor>
                [{cmd.type}] {summarizeDescription(cmd.description)}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function getCommandColumnWidth(commands: SlashCommand[]): number {
  const longestCommand = commands.reduce((max, command) => Math.max(max, command.name.length), 0);
  return longestCommand + 4;
}

function summarizeDescription(description: string, maxLength = 72): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function getVisibleWindow(total: number, selectedIndex: number, maxVisible: number) {
  if (total <= maxVisible) {
    return { startIndex: 0, endIndex: total };
  }

  const halfWindow = Math.floor(maxVisible / 2);
  const maxStartIndex = total - maxVisible;
  const startIndex = Math.max(0, Math.min(selectedIndex - halfWindow, maxStartIndex));

  return {
    startIndex,
    endIndex: startIndex + maxVisible,
  };
}
