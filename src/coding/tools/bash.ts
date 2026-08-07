import z from "zod";

import { defineTool } from "@/foundation";

const MAX_STDOUT_BYTES = 12000;
const MAX_STDERR_BYTES = 12000;

async function drainLimited(stream: ReadableStream<Uint8Array>, maxBytes: number, label: string) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let capturedBytes = 0;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (capturedBytes >= maxBytes) continue;

    const take = Math.min(maxBytes - capturedBytes, value.byteLength);
    chunks.push(value.subarray(0, take));
    capturedBytes += take;
  }

  const captured = new Uint8Array(capturedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    captured.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const truncatedBytes = totalBytes - capturedBytes;
  const text = new TextDecoder().decode(captured);
  return {
    text: truncatedBytes > 0 ? `${text}\n... [${label} truncated ${truncatedBytes} bytes]` : text,
    truncated: truncatedBytes > 0,
  };
}

export const bashTool = defineTool({
  name: "bash",
  description: "Execute a bash command in a unix-like environment",
  parameters: z.object({
    description: z
      .string()
      .describe("Explain why you want to execute the command. Always place `description` as the first parameter."),
    command: z.string().describe("The bash command to execute."),
  }),
  invoke: async ({ command }, signal) => {
    // Execute the command and return bounded output while fully draining both pipes.
    const proc = Bun.spawn({
      cmd: ["bash", "-c", command],
      stdout: "pipe",
      stderr: "pipe",
    });

    if (signal) {
      const onAbort = () => proc.kill();
      signal.addEventListener("abort", onAbort, { once: true });
      void proc.exited.then(() => signal.removeEventListener("abort", onAbort));
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      drainLimited(proc.stdout, MAX_STDOUT_BYTES, "stdout"),
      drainLimited(proc.stderr, MAX_STDERR_BYTES, "stderr"),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      return `Error: Command ${command} failed with exit code ${exitCode}: ${stderr.text}`;
    }
    return stdout.text;
  },
});
