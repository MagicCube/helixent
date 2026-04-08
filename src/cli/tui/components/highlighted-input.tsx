import { Text } from "ink";

import { currentTheme } from "../themes";

export function HighlightedInput({
  value,
  cursorOffset,
  placeholder,
  highlightedCommandName,
}: {
  value: string;
  cursorOffset: number;
  placeholder: string;
  highlightedCommandName?: string | null;
}) {
  if (value.length === 0) {
    return (
      <Text>
        <Text inverse dimColor>
          {placeholder[0] ?? " "}
        </Text>
        <Text dimColor>{placeholder.slice(1)}</Text>
      </Text>
    );
  }

  const highlightLength = highlightedCommandName ? highlightedCommandName.length + 1 : 0;

  return (
    <Text>
      {value.split("").map((char, index) => {
        const highlighted = index < highlightLength;
        return (
          <Text
            key={`${char}-${index}`}
            bold={highlighted}
            color={highlighted ? currentTheme.colors.primary : undefined}
            inverse={index === cursorOffset}
          >
            {char}
          </Text>
        );
      })}
      {cursorOffset === value.length ? <Text inverse>{" "}</Text> : null}
    </Text>
  );
}
