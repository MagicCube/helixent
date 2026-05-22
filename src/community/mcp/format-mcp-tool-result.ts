import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

export type McpCallToolResult = Awaited<ReturnType<Client["callTool"]>>;

/**
 * Pretty-print an MCP `tools/call` result for LLM tool_result text.
 */
export function formatMcpCallToolResult(result: McpCallToolResult): string {
  if ("toolResult" in result && result.toolResult !== undefined) {
    const tr = result.toolResult;
    return typeof tr === "string" ? tr : JSON.stringify(tr, null, 2);
  }

  const blocks = "content" in result && Array.isArray(result.content) ? result.content : [];
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      lines.push(block.text);
    } else {
      lines.push(JSON.stringify(block));
    }
  }

  let out = lines.join("\n\n");

  if ("structuredContent" in result && result.structuredContent !== undefined) {
    const extra = JSON.stringify(result.structuredContent, null, 2);
    out = out ? `${out}\n\n${extra}` : extra;
  }

  if ("isError" in result && result.isError) {
    out = out ? `Error:\n${out}` : "Error (no message)";
  }

  return out || "(empty MCP tool result)";
}
