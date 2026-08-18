/**
 * The read tools this server exposes. Each one mirrors a MagicDoor list endpoint: the same
 * filters the property-manager web app offers, and the same paginated response.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MagicDoorClient, QueryValue } from "./client.js";

/** Every list endpoint pages the same way. Kept modest so a single call stays readable. */
const pagination = {
  page: z.number().int().min(1).optional().describe("1-based page number. Defaults to 1."),
  pageSize: z.number().int().min(1).max(100).optional().describe("Results per page, 1-100. Defaults to 25."),
};

const searchable = {
  search: z.string().optional().describe("Free-text search across the record's main fields."),
  active: z.boolean().optional().describe("Only active records when true, only inactive when false."),
};

export function registerTools(server: McpServer, client: MagicDoorClient): void {
  register(server, client, {
    name: "list_properties",
    title: "List properties",
    description:
      "List the properties this company manages, with their address, type and unit count. " +
      "Use to answer questions about the portfolio, or to find a property id for other tools.",
    path: "properties",
    schema: {
      ...pagination,
      ...searchable,
      name: z.string().optional().describe("Match on property name."),
      portfolioId: z.string().optional().describe("Only properties in this portfolio."),
      ownerId: z.string().optional().describe("Only properties owned by this owner."),
    },
  });

  register(server, client, {
    name: "list_units",
    title: "List units",
    description:
      "List rentable units, optionally narrowed to one property. Use to find a unit id, or to " +
      "answer questions about how many units a property has and which are occupied.",
    path: "units",
    schema: {
      ...pagination,
      ...searchable,
      name: z.string().optional().describe("Match on unit name or number."),
      propertyId: z.string().optional().describe("Only units in this property."),
      portfolioId: z.string().optional().describe("Only units in this portfolio."),
    },
  });

  register(server, client, {
    name: "list_leases",
    title: "List leases",
    description:
      "List leases with their term, rent and balance. Use for questions about who is renting " +
      "what, which leases carry a balance, and when terms start or end.",
    path: "leases",
    schema: {
      ...pagination,
      propertyId: z.string().optional().describe("Only leases on this property."),
      unitId: z.string().optional().describe("Only leases on this unit."),
      portfolioId: z.string().optional().describe("Only leases in this portfolio."),
      tenantIds: z.array(z.string()).optional().describe("Only leases involving these tenants."),
      monthToMonth: z.boolean().optional().describe("Only month-to-month leases when true."),
      eviction: z.boolean().optional().describe("Only leases in eviction when true."),
      withBalance: z.boolean().optional().describe("Only leases carrying a balance when true."),
    },
  });

  register(server, client, {
    name: "list_tenants",
    title: "List tenants",
    description:
      "List tenants with their contact details and portal status. Use to find a tenant id, or " +
      "to answer questions about who lives where and how to reach them.",
    path: "tenants",
    schema: {
      ...pagination,
      ...searchable,
      firstOrLastName: z.string().optional().describe("Match on either first or last name."),
      email: z.string().optional().describe("Match on email address."),
      phone: z.string().optional().describe("Match on phone number."),
      hasLease: z.boolean().optional().describe("Only tenants who currently hold a lease when true."),
    },
  });

  register(server, client, {
    name: "list_owners",
    title: "List owners",
    description:
      "List property owners with their contact details. Use to find an owner id, or to answer " +
      "questions about who owns which properties.",
    path: "owners",
    schema: {
      ...pagination,
      ...searchable,
      firstOrLastName: z.string().optional().describe("Match on either first or last name."),
      email: z.string().optional().describe("Match on email address."),
      phone: z.string().optional().describe("Match on phone number."),
      propertyIds: z.array(z.string()).optional().describe("Only owners of these properties."),
      portfolioIds: z.array(z.string()).optional().describe("Only owners in these portfolios."),
    },
  });

  register(server, client, {
    name: "list_lease_renewals",
    title: "List lease renewals",
    description:
      "List lease renewals across the company — the record of a lease's term and rent changing. " +
      "Use for questions about upcoming or recent renewals and how rent moved.",
    path: "leases/renewals",
    schema: { ...pagination },
  });
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  path: string;
  schema: z.ZodRawShape;
}

function register(server: McpServer, client: MagicDoorClient, tool: ToolDefinition): void {
  server.registerTool(
    tool.name,
    { title: tool.title, description: tool.description, inputSchema: tool.schema },
    async (args: Record<string, unknown>) => {
      try {
        const result = await client.get(tool.path, {
          ...(args as Record<string, QueryValue>),
          pageSize: (args.pageSize as number | undefined) ?? 25,
        });

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        // Surfaced to the model as tool output rather than thrown, so it can explain the problem
        // to the user or adjust the call instead of the conversation simply failing.
        return {
          isError: true,
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
        };
      }
    },
  );
}
