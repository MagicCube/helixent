import { Box, Text } from "ink";
import { memo, useMemo } from "react";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

import { currentTheme } from "../themes";

marked.setOptions({
  renderer: new TerminalRenderer() as never,
});

/**
 * Renders streaming text output from the model in real time.
 *
 * In **Ink mode** the accumulated text is rendered as Markdown inside the
 * React tree. This component is shown *while* the model is producing text
 * tokens and is replaced by the final {@link MessageHistoryItem} once the
 * assistant turn completes.
 */
export const StreamingMessage = memo(function StreamingMessage({
  text,
}: {
  text: string;
}) {
  const rendered = useMemo(() => {
    if (!text) return "";
    return marked(text).trimEnd();
  }, [text]);

  if (!text) return null;

  return (
    <Box columnGap={1}>
      <Text color={currentTheme.colors.highlightedText}>⏺</Text>
      <Box flexDirection="column" rowGap={0}>
        <Text>{rendered}</Text>
      </Box>
    </Box>
  );
});
