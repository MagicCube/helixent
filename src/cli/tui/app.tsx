import { Box } from "ink";

import { Header } from "./components/header";
import { InputBox } from "./components/input-box";
import { MessageHistory } from "./components/message-history";
import { StreamingIndicator } from "./components/streaming-indicator";
import { useAgentLoop } from "./hooks/use-agent-loop";

export function App() {
  const { streaming, messages, onSubmit, abort } = useAgentLoop();
  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      <Header />
      <MessageHistory messages={messages} streaming={streaming} />
      <StreamingIndicator streaming={streaming} />
      <InputBox
        onSubmit={onSubmit}
        onAbort={abort}
      />
    </Box>
  );
}
