import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  type StdioServerParameters,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";

import type { Tool } from "@/foundation";
import { defineTool } from "@/foundation";

import { formatMcpCallToolResult } from "./format-mcp-tool-result";
import { mcpInputSchemaToZod } from "./mcp-input-schema";

export type { StdioServerParameters };

export interface StdioMcpToolsSession {
  /** Helixent {@link Tool} wrappers bound to this MCP server. */
  tools: Tool[];
  /** Underlying MCP client (initialized after {@link createStdioMcpTools} resolves). */
  client: Client;
  /** Close stdio transport and release the child process. */
  dispose: () => Promise<void>;
}

async function listAllMcpTools(client: Client) {
  const tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

/**
 * Connect to an MCP server over stdio, list its tools, and build Helixent {@link Tool}s that forward to `tools/call`.
 *
 * @param server - Spawn parameters (command, args, env, cwd, etc.).
 * @param options.namePrefix - Optional prefix for tool names to avoid collisions with built-in tools.
 */
export async function createStdioMcpTools(
  server: StdioServerParameters,
  options?: { namePrefix?: string },
): Promise<StdioMcpToolsSession> {
  const namePrefix = options?.namePrefix ?? "";
  const transport = new StdioClientTransport(server);
  const client = new Client({ name: "helixent", version: "1.0.0" });

  await client.connect(transport);

  const listed = await listAllMcpTools(client);

  const tools: Tool[] = listed.map((mcpTool) => {
    const helixentName = `${namePrefix}${mcpTool.name}`;
    const parameters = mcpInputSchemaToZod(mcpTool.inputSchema as Record<string, unknown>);

    return defineTool({
      name: helixentName,
      description: mcpTool.description?.trim()
        ? `[MCP] ${mcpTool.description}`
        : `[MCP tool ${mcpTool.name}]`,
      parameters,
      invoke: async (input, signal) => {
        const parsed = parameters.safeParse(input);
        if (!parsed.success) {
          return `Error: Invalid arguments for MCP tool ${mcpTool.name}: ${parsed.error.message}`;
        }

        const result = await client.callTool(
          {
            name: mcpTool.name,
            arguments: parsed.data as Record<string, unknown>,
          },
          undefined,
          signal ? { signal } : undefined,
        );

        return formatMcpCallToolResult(result);
      },
    });
  });

  const dispose = async () => {
    await transport.close();
  };

  return { tools, client, dispose };
}
