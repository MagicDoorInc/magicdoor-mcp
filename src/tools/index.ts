import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MagicDoorClient } from "../client.js";
import { registerTool, type ToolDefinition } from "../registry.js";
import { portfolioTools } from "./portfolio.js";
import { leaseTools } from "./leases.js";
import { accountingTools } from "./accounting.js";
import { maintenanceTools } from "./maintenance.js";
import { chatTools } from "./chats.js";

/** Every tool this server exposes. All read-only — nothing here writes to MagicDoor. */
export const allTools: ToolDefinition[] = [...portfolioTools, ...leaseTools, ...accountingTools, ...maintenanceTools, ...chatTools];

export function registerTools(server: McpServer, client: MagicDoorClient): void {
  for (const tool of allTools) {
    registerTool(server, client, tool);
  }
}
