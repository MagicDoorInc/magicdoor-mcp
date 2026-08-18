/**
 * The people and places: properties, units, tenants and owners.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

const searchable = {
  search: z.string().optional().describe("Free-text search across the record's main fields."),
  active: z.boolean().optional().describe("Only active records when true, only inactive when false."),
};

export const portfolioTools: ToolDefinition[] = [
  {
    name: "list_properties",
    title: "List properties",
    description:
      "List the properties this company manages, with their address, type and unit count. Use to " +
      "answer questions about the portfolio, or to find a property id for other tools.",
    path: "properties",
    paginated: true,
    schema: {
      ...searchable,
      name: z.string().optional().describe("Match on property name."),
      portfolioId: z.string().optional().describe("Only properties in this portfolio."),
      ownerId: z.string().optional().describe("Only properties owned by this owner."),
    },
  },
  {
    name: "list_units",
    title: "List units",
    description:
      "List rentable units, optionally narrowed to one property. Use to find a unit id, or to " +
      "answer questions about how many units a property has and which are occupied.",
    path: "units",
    paginated: true,
    schema: {
      ...searchable,
      name: z.string().optional().describe("Match on unit name or number."),
      propertyId: z.string().optional().describe("Only units in this property."),
      portfolioId: z.string().optional().describe("Only units in this portfolio."),
    },
  },
  {
    name: "list_tenants",
    title: "List tenants",
    description:
      "List tenants with their contact details and portal status. Use to find a tenant id, or to " +
      "answer questions about who lives where and how to reach them.",
    path: "tenants",
    paginated: true,
    schema: {
      ...searchable,
      firstOrLastName: z.string().optional().describe("Match on either first or last name."),
      email: z.string().optional().describe("Match on email address."),
      phone: z.string().optional().describe("Match on phone number."),
      hasLease: z.boolean().optional().describe("Only tenants who currently hold a lease when true."),
    },
  },
  {
    name: "list_owners",
    title: "List owners",
    description:
      "List property owners with their contact details. Use to find an owner id, or to answer " +
      "questions about who owns which properties.",
    path: "owners",
    paginated: true,
    schema: {
      ...searchable,
      firstOrLastName: z.string().optional().describe("Match on either first or last name."),
      email: z.string().optional().describe("Match on email address."),
      phone: z.string().optional().describe("Match on phone number."),
      propertyIds: z.array(z.string()).optional().describe("Only owners of these properties."),
      portfolioIds: z.array(z.string()).optional().describe("Only owners in these portfolios."),
    },
  },
];
