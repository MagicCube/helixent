import { Box, Text, useInput } from "ink";
import { memo, useState } from "react";

import type { ModelEntry } from "@/cli/config";

import { currentTheme } from "../themes";
import { getVisibleWindow } from "../visible-window";

const MAX_VISIBLE_MODELS = 8;

export const ModelSelectionPrompt = memo(function ModelSelectionPrompt({
  models,
  currentModelName,
  defaultModelName,
  onCancel,
  onSelect,
}: {
  models: ModelEntry[];
  currentModelName: string;
  defaultModelName?: string;
  onCancel: () => void;
  // eslint-disable-next-line no-unused-vars
  onSelect: (modelName: string) => void;
}) {
  const initialIndex = Math.max(0, models.findIndex((model) => model.name === currentModelName));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((index) => (index > 0 ? index - 1 : models.length - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((index) => (index < models.length - 1 ? index + 1 : 0));
      return;
    }

    if (key.return) {
      const selected = models[selectedIndex];
      if (selected) {
        onSelect(selected.name);
      }
    }
  });

  const { endIndex, startIndex } = getVisibleWindow(models.length, selectedIndex, MAX_VISIBLE_MODELS);
  const visibleModels = models.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={currentTheme.colors.borderColor} paddingX={1}>
      <Text bold color={currentTheme.colors.primary}>
        Select model
      </Text>
      {visibleModels.map((model, visibleIndex) => {
        const index = startIndex + visibleIndex;
        const selected = index === selectedIndex;
        const markers = [
          model.name === currentModelName ? "current" : null,
          model.name === defaultModelName ? "default" : null,
        ].filter(Boolean);
        const suffix = markers.length > 0 ? ` (${markers.join(", ")})` : "";

        return (
          <Box key={model.name} flexDirection="row">
            <Text color={selected ? currentTheme.colors.highlightedText : undefined} bold={selected}>
              {selected ? "❯ " : "  "}
            </Text>
            <Text color={selected ? currentTheme.colors.highlightedText : undefined} bold={selected}>
              {model.name}
            </Text>
            <Text dimColor>
              {suffix} - {model.provider ?? "openai"} - {model.baseURL}
            </Text>
          </Box>
        );
      })}
      <Text color={currentTheme.colors.dimText}>↑/↓ move · Enter switch · Esc cancel</Text>
    </Box>
  );
});
