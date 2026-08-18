/**
 * Turns a declarative tool definition into a registered MCP tool.
 *
 * A definition names a path template such as `leases/{leaseId}/charges/ledger`. Arguments whose
 * name appears in the template are substituted into the path; everything else becomes a query
 * parameter, so a tool is described in one place rather than split across a schema and a handler.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MagicDoorClient, QueryValue } from "./client.js";
import type { ServiceName } from "./config.js";

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  /** Which MagicDoor service serves this endpoint. Defaults to the portal API. */
  service?: ServiceName;
  /** Path under that service's property-manager area, with `{argument}` placeholders. */
  path: string;
  schema: z.ZodRawShape;
  /** Adds page/pageSize and defaults the size, for endpoints that return a page. */
  paginated?: boolean;
}

/** Every paginated endpoint takes these, and they are described identically everywhere. */
export const pagination = {
  page: z.number().int().min(1).optional().describe("1-based page number. Defaults to 1."),
  pageSize: z.number().int().min(1).max(100).optional().describe("Results per page, 1-100. Defaults to 25."),
};

const DEFAULT_PAGE_SIZE = 25;

export function registerTool(server: McpServer, client: MagicDoorClient, tool: ToolDefinition): void {
  const inputSchema = tool.paginated ? { ...pagination, ...tool.schema } : tool.schema;

  server.registerTool(
    tool.name,
    { title: tool.title, description: tool.description, inputSchema },
    async (args: Record<string, unknown>) => {
      try {
        const { path, query } = applyPathParameters(tool.path, args);
        if (tool.paginated && query.pageSize === undefined) {
          query.pageSize = DEFAULT_PAGE_SIZE;
        }

        const result = await client.get(tool.service ?? "portal", path, query);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        // Returned as tool output rather than thrown, so the model can explain the problem or
        // adjust its call instead of the whole conversation failing.
        return {
          isError: true,
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
        };
      }
    },
  );
}

function applyPathParameters(
  template: string,
  args: Record<string, unknown>,
): { path: string; query: Record<string, QueryValue> } {
  const query: Record<string, QueryValue> = { ...(args as Record<string, QueryValue>) };

  const path = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = args[name];
    if (value === undefined || value === null || value === "") {
      throw new Error(`${name} is required.`);
    }

    delete query[name];
    return encodeURIComponent(String(value));
  });

  return { path, query };
}
