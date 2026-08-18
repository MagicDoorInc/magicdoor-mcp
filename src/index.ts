#!/usr/bin/env node
/**
 * MagicDoor MCP server.
 *
 * Runs on the user's own machine and speaks MCP over stdio, so an assistant such as Claude can
 * read the properties, units, leases, tenants and owners the API key is allowed to see.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TokenProvider } from "./auth.js";
import { MagicDoorClient } from "./client.js";
import { registerTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const server = new McpServer({ name: "magicdoor", version: "0.1.0" });
  registerTools(server, new MagicDoorClient(config, new TokenProvider(config)));

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  // stdout carries the MCP protocol, so anything human-readable has to go to stderr.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
