import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MagicDoorClient } from "../client.js";
import { registerTool, type ToolDefinition } from "../registry.js";
import { portfolioTools } from "./portfolio.js";
import { leaseTools } from "./leases.js";

/** Every tool this server exposes. All read-only — nothing here writes to MagicDoor. */
export const allTools: ToolDefinition[] = [...portfolioTools, ...leaseTools];

export function registerTools(server: McpServer, client: MagicDoorClient): void {
  for (const tool of allTools) {
    registerTool(server, client, tool);
  }
}
