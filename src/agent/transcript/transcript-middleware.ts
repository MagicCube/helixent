import { randomUUID } from "crypto";
import { join } from "path";

import type { AgentMiddleware } from "../agent-middleware";
import { appendEntry, getProjectDir } from "./transcript-storage";

/**
 * Creates a middleware that persists all messages to a JSONL transcript file.
 */
export function createTranscriptMiddleware(options: {
  cwd: string;
  projectDir?: string;
}): AgentMiddleware {
  let transcriptPath: string;
  let lastWrittenIndex = 0;

  return {
    beforeAgentRun: async ({ agentContext }) => {
      const sessionId = randomUUID();
      const dir = options.projectDir ?? getProjectDir(options.cwd);
      transcriptPath = join(dir, `${sessionId}.jsonl`);

      for (const msg of agentContext.messages) {
        appendEntry(transcriptPath, msg);
      }
      lastWrittenIndex = agentContext.messages.length;
      return null;
    },

    afterAgentStep: async ({ agentContext }) => {
      const newMessages = agentContext.messages.slice(lastWrittenIndex);
      for (const msg of newMessages) {
        appendEntry(transcriptPath, msg);
      }
      lastWrittenIndex = agentContext.messages.length;
      return null;
    },
  };
}
