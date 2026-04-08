import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { memo, useMemo, useState } from "react";

import { currentTheme } from "../themes";

const WELCOME_MESSAGES = [
  "To the moon!",
  "What do you want to build today?",
  "Hey, there!",
  "What's on your mind?",
  "Build, build, build!",
  "What's your plan today?",
  "Dream, code, repeat!",
  "Your next idea goes here...",
];

function InputBoxImpl({
  onSubmit,
  onAbort,
}: {
  // eslint-disable-next-line no-unused-vars
  onSubmit?: (text: string) => void;
  onAbort?: () => void;
}) {
  const [firstMessage, setFirstMessage] = useState(true);
  const [text, setText] = useState("");
  const firstPlaceholder = useMemo(
    () => WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)],
    [],
  );

  const handleChange = (text: string) => {
    setText(text);
  };
  useInput(
    (_input, key) => {
      if (key.escape || (key.ctrl && _input === "c")) {
        onAbort?.();
      }
    },
    { isActive: true },
  );

  const handleSubmit = () => {
    onSubmit?.(text);
    setText("");
    setFirstMessage(false);
  };
  return (
    <Box
      borderLeft={false}
      borderRight={false}
      borderStyle="single"
      borderColor={currentTheme.colors.borderColor}
      columnGap={1}
    >
      <Text>❯</Text>
      <TextInput
        placeholder={
          firstMessage
            ? firstPlaceholder
            : "Input anything to continue. Launch a new command or skill by typing `/`"
        }
        value={text}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}

export const InputBox = memo(InputBoxImpl);
