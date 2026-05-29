import { Box, Text } from "ink";

import type { SlashCommand } from "../command-registry";
import { currentTheme } from "../themes";
import { getVisibleWindow } from "../visible-window";

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
  return (
    <Box
      flexDirection="column"
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
          <Text
            color={index === selectedIndex ? currentTheme.colors.highlightedText : undefined}
            bold={index === selectedIndex}
          >
            {index === selectedIndex ? "❯ " : "  "}
          </Text>
          <Text
            color={index === selectedIndex ? currentTheme.colors.highlightedText : undefined}
            bold={index === selectedIndex}
          >
            /{cmd.name}
          </Text>
          <Text dimColor>
            {" "}
            [{cmd.type}] {summarizeDescription(cmd.description)}
          </Text>
        </Box>
        );
      })}
    </Box>
  );
}

function summarizeDescription(description: string, maxLength = 72): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}
