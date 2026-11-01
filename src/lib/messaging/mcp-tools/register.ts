import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type MessagingMcpCaller = { userId: string; keyId: string } | null;

export function registerMessagingTools(
  server: McpServer,
  caller: MessagingMcpCaller,
): McpServer {
  // Tools are added in Phase 6, after the data model and send policies exist.
  if (!caller) return server;
  return server;
}
