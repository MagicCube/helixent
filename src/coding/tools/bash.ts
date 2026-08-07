import z from "zod";

import { defineTool } from "@/foundation";

const MAX_STDERR_BYTES = 12000;

async function drainLimited(stream: ReadableStream<Uint8Array>, maxBytes: number) {
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
    text: truncatedBytes > 0 ? `${text}\n... [stderr truncated ${truncatedBytes} bytes]` : text,
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
    // Execute the command and return the standard output or standard error.
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

    const [output, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      drainLimited(proc.stderr, MAX_STDERR_BYTES),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      return `Error: Command ${command} failed with exit code ${exitCode}: ${stderr.text}`;
    }
    return output;
  },
});
