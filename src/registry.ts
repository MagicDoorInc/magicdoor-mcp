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
  /**
   * Path under that service's property-manager area, with `{argument}` placeholders. A function
   * instead, when one tool covers several endpoints that differ only by a path segment — the
   * argument that selects between them is consumed rather than sent as a query parameter.
   */
  path: string | ((args: Record<string, unknown>) => string);
  schema: z.ZodRawShape;
  /**
   * Adds page/pageSize and defaults the size, for endpoints that return a page. A predicate
   * instead, for a tool that pages when listing but fetches a single record when given an id.
   */
  paginated?: boolean | ((args: Record<string, unknown>) => boolean);
  /** Arguments the path function used to choose an endpoint, which must not become query parameters. */
  consumes?: string[];
  /**
   * Trims a response before the model sees it. Some MagicDoor endpoints return their whole
   * collection with no way to page it — `/chats` answers with every chat the company has ever
   * had — which would swamp the context in a single call.
   */
  shape?: (payload: unknown, args: Record<string, unknown>) => unknown;
}

/** Every paginated endpoint takes these, and they are described identically everywhere. */
export const pagination = {
  page: z.number().int().min(1).optional().describe("1-based page number. Defaults to 1."),
  pageSize: z.number().int().min(1).max(100).optional().describe("Results per page, 1-100. Defaults to 25."),
};

const DEFAULT_PAGE_SIZE = 25;

export function registerTool(server: McpServer, client: MagicDoorClient, tool: ToolDefinition): void {
  const inputSchema = tool.paginated ? { ...pagination, ...tool.schema } : tool.schema;
  const pages = (args: Record<string, unknown>) =>
    typeof tool.paginated === "function" ? tool.paginated(args) : Boolean(tool.paginated);

  server.registerTool(
    tool.name,
    { title: tool.title, description: tool.description, inputSchema },
    async (args: Record<string, unknown>) => {
      try {
        const template = typeof tool.path === "function" ? tool.path(args) : tool.path;
        const { path, query } = applyPathParameters(template, args, tool.consumes);
        if (pages(args) && query.pageSize === undefined) {
          query.pageSize = DEFAULT_PAGE_SIZE;
        }

        const result = await client.get(tool.service ?? "portal", path, query);
        const shaped = tool.shape ? tool.shape(result, args) : result;

        return { content: [{ type: "text" as const, text: render(shaped) }] };
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
  consumes: string[] = [],
): { path: string; query: Record<string, QueryValue> } {
  const query: Record<string, QueryValue> = { ...(args as Record<string, QueryValue>) };

  for (const name of consumes) {
    delete query[name];
  }

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

/**
 * A last line of defence for endpoints whose size we have not measured: better a clearly
 * truncated answer than one that fills the context and crowds out the conversation.
 */
const MAX_RESPONSE_CHARACTERS = 200_000;

function render(payload: unknown): string {
  const text = JSON.stringify(payload, null, 2);
  if (text.length <= MAX_RESPONSE_CHARACTERS) {
    return text;
  }

  return (
    text.slice(0, MAX_RESPONSE_CHARACTERS) +
    `\n\n... truncated at ${MAX_RESPONSE_CHARACTERS} characters of ${text.length}. ` +
    `Narrow the request with filters or a smaller pageSize to see the rest.`
  );
}
