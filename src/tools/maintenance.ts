/**
 * Maintenance: what tenants reported, what work is happening, who is doing it.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";
import { oneOrMany, selectPath } from "./shared.js";

const place = {
  propertyIds: z.array(z.string()).optional().describe("Only work at these properties."),
  unitIds: z.array(z.string()).optional().describe("Only work at these units."),
  portfolioIds: z.array(z.string()).optional().describe("Only work in these portfolios."),
};

const window = {
  start: z.string().optional().describe("Only records from this date onwards, YYYY-MM-DD."),
  end: z.string().optional().describe("Only records up to this date, YYYY-MM-DD."),
};

const workOrderStatus = z
  .array(z.enum(["Pending", "InProgress", "Completed", "Closed", "Cancelled"]))
  .optional()
  .describe("Only work orders in these states.");

/**
 * The scheduling view returns every booked work order at once. Cap it so a busy company's
 * schedule cannot swamp the context, and say what was left out.
 */
function capList(payload: unknown, limit: number): unknown {
  // The endpoint answers with { items: [...] }; tolerate a bare array in case that changes.
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : null;

  if (!items || items.length <= limit) {
    return payload;
  }

  return {
    items: items.slice(0, limit),
    totalCount: items.length,
    omitted: items.length - limit,
    note: `Showing ${limit} of ${items.length}. Narrow with a date window, property or status.`,
  };
}

const HISTORY_PATHS = { request: "maintenance-requests", workOrder: "work-orders" } as const;
const CATEGORY_PATHS = { request: "maintenance-requests/categories", vendor: "vendors/categories" } as const;
const VENDOR_DETAIL_PATHS = { overview: "overview", customFields: "custom-fields" } as const;

export const maintenanceTools: ToolDefinition[] = [
  {
    name: "get_maintenance_requests",
    title: "Maintenance requests",
    description:
      "What tenants have reported as needing fixing. Pass maintenanceRequestId for one request in " +
      "full; omit it to list what matches the filters. Use for 'what is broken', 'what came in " +
      "this week', and finding a request to look into.",
    service: "maintenance",
    ...oneOrMany("maintenanceRequestId", "maintenance-requests"),
    schema: {
      maintenanceRequestId: z.string().optional().describe("Return just this request, in full."),
      ...window,
      propertyId: z.string().optional().describe("Only requests at this property."),
      unitId: z.string().optional().describe("Only requests at this unit."),
      portfolioId: z.string().optional().describe("Only requests in this portfolio."),
      leaseId: z.string().optional().describe("Only requests against this lease."),
      tenantId: z.string().optional().describe("Only requests raised by this tenant."),
      categoryId: z.string().optional().describe("Only requests in this category."),
      status: z
        .array(z.enum(["Pending", "InProgress", "AiProcessing", "WaitingForWorkOrder", "Closed"]))
        .optional()
        .describe("Only requests in these states."),
      urgency: z
        .enum(["Urgent", "High", "Medium", "Low", "None"])
        .optional()
        .describe("Only requests at this urgency."),
      searchText: z.string().optional().describe("Free-text search of the request."),
      new: z.boolean().optional().describe("Only requests nobody has looked at yet when true."),
    },
  },
  {
    name: "get_maintenance_request_stats",
    title: "Maintenance request statistics",
    description:
      "Counts of maintenance requests by state — the headline numbers without listing them. Use " +
      "for 'how much is outstanding' questions.",
    service: "maintenance",
    path: "maintenance-requests/stats",
    schema: {},
  },
  {
    name: "get_work_orders",
    title: "Work orders",
    description:
      "The work raised to fix things. Pass workOrderId for one in full; omit it to list what " +
      "matches the filters. Use for 'what work is open' and 'what is this vendor doing'.",
    service: "maintenance",
    ...oneOrMany("workOrderId", "work-orders"),
    schema: {
      workOrderId: z.string().optional().describe("Return just this work order, in full."),
      ...place,
      ...window,
      leaseIds: z.array(z.string()).optional().describe("Only work against these leases."),
      vendorIds: z.array(z.string()).optional().describe("Only work assigned to these vendors."),
      maintenanceRequestIds: z.array(z.string()).optional().describe("Only work raised from these requests."),
      status: workOrderStatus,
      reference: z.string().optional().describe("Match on the work order's reference number."),
      searchText: z.string().optional().describe("Free-text search of the work order."),
      active: z.boolean().optional().describe("Only work that is still open when true."),
    },
  },
  {
    name: "get_work_order_schedule",
    title: "Scheduled work",
    description:
      "Work orders arranged by when they are booked in, the view used for planning a day or week. " +
      "Use for 'what is happening on Tuesday' questions.",
    service: "maintenance",
    path: "work-orders/schedule",
    shape: (payload, args) => capList(payload, typeof args.limit === "number" ? args.limit : 50),
    schema: {
      ...place,
      ...window,
      status: workOrderStatus,
      limit: z.number().int().min(1).max(200).optional().describe("How many to return. Defaults to 50."),
    },
  },
  {
    name: "get_maintenance_history",
    title: "History of a request or work order",
    description:
      "The timeline of one maintenance request or work order — status changes, assignment and " +
      "scheduling, and who did each. Use for 'what happened with this' and 'why is it taking so " +
      "long' questions.",
    service: "maintenance",
    path: (args) => selectPath(HISTORY_PATHS, args.type, (segment) => `${segment}/{id}/history`),
    consumes: ["type"],
    schema: {
      type: z.enum(["request", "workOrder"]).describe("Whether the id is a maintenance request or a work order."),
      id: z.string().describe("The maintenance request or work order id."),
    },
  },
  {
    name: "get_recurring_work_orders",
    title: "Recurring work orders",
    description:
      "Work that repeats on a schedule, such as quarterly servicing. Pass recurringWorkOrderId for " +
      "one in full; omit it to list them. Use to explain standing maintenance as opposed to " +
      "one-off jobs.",
    service: "maintenance",
    ...oneOrMany("recurringWorkOrderId", "work-orders/recurring"),
    schema: {
      recurringWorkOrderId: z.string().optional().describe("Return just this recurring work order."),
      ...place,
      vendorIds: z.array(z.string()).optional().describe("Only recurring work for these vendors."),
      active: z.boolean().optional().describe("Only schedules still running when true."),
      search: z.string().optional().describe("Free-text search."),
    },
  },
  {
    name: "get_recurring_work_order_stats",
    title: "Recurring work statistics",
    description: "How a recurring work order has performed — how often it ran and what it has cost.",
    service: "maintenance",
    path: "work-orders/recurring/{recurringWorkOrderId}/stats",
    schema: { recurringWorkOrderId: z.string().describe("The id, from get_recurring_work_orders.") },
  },
  {
    name: "get_vendors",
    title: "Vendors",
    description:
      "The contractors and suppliers who do the work. Pass vendorId for one in full; omit it to " +
      "list vendors matching the filters. Use for 'who do we use for plumbing' questions.",
    service: "maintenance",
    ...oneOrMany("vendorId", "vendors"),
    schema: {
      vendorId: z.string().optional().describe("Return just this vendor, in full."),
      name: z.string().optional().describe("Match on vendor name."),
      categoryId: z.string().optional().describe("Only vendors in this trade category."),
      email: z.string().optional().describe("Match on email address."),
      phoneNumber: z.string().optional().describe("Match on phone number."),
      active: z.boolean().optional().describe("Only active vendors when true."),
      search: z.string().optional().describe("Free-text search across the vendor's details."),
    },
  },
  {
    name: "get_vendor_detail",
    title: "A vendor's overview or custom fields",
    description:
      "Either a vendor's work at a glance — how much they have done and what it has cost, for " +
      "'how much do we spend with them' questions — or the company-defined custom fields recorded " +
      "against them.",
    service: "maintenance",
    path: (args) => selectPath(VENDOR_DETAIL_PATHS, args.detail, (segment) => `vendors/{vendorId}/${segment}`),
    consumes: ["detail"],
    schema: {
      vendorId: z.string().describe("The vendor id, from get_vendors."),
      detail: z.enum(["overview", "customFields"]).describe("Which view of the vendor to fetch."),
    },
  },
  {
    name: "list_maintenance_categories",
    title: "Maintenance and vendor categories",
    description:
      "The categories requests are filed under, or the trade categories vendors are grouped into. " +
      "Use to find a category id for filtering, or to explain how work is classified.",
    service: "maintenance",
    path: (args) => selectPath(CATEGORY_PATHS, args.type, (segment) => segment),
    consumes: ["type"],
    schema: {
      type: z.enum(["request", "vendor"]).describe("Which set of categories to list."),
    },
  },
  {
    name: "get_run_books",
    title: "Run books",
    description:
      "The standing instructions for handling particular kinds of maintenance — who to call and " +
      "what to authorise. Pass runBookId for one in full; omit it to list them. Use for 'what is " +
      "our process for X' questions.",
    service: "maintenance",
    ...oneOrMany("runBookId", "run-books"),
    schema: {
      runBookId: z.string().optional().describe("Return just this run book, in full."),
      title: z.string().optional().describe("Match on the run book's title."),
    },
  },
];
