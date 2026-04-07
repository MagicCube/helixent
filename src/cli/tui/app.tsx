import { Box } from "ink";

import { Header } from "./components/header";
import { InputBox } from "./components/input-box";
import { LoadingIndicator } from "./components/loading-indicator";
import { MessageHistory } from "./components/message-history";
import { useAgentLoop } from "./hooks/use-agent-loop";

export function App() {
  const { loading, messages, onSubmit } = useAgentLoop();
  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      <Header />
      <MessageHistory messages={messages} isBusy={loading} />
      <LoadingIndicator loading={loading} />
      <InputBox disabled={loading} onSubmit={onSubmit} />
    </Box>
  );
}
