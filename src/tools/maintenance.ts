/**
 * Maintenance: what tenants reported, what work is happening, who is doing it.
 * Served by the maintenance service.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

const workOrderStatus = z
  .array(z.enum(["Pending", "InProgress", "Completed", "Closed", "Cancelled"]))
  .optional()
  .describe("Only work orders in these states.");

const requestStatus = z
  .array(z.enum(["Pending", "InProgress", "AiProcessing", "WaitingForWorkOrder", "Closed"]))
  .optional()
  .describe("Only requests in these states.");

const place = {
  propertyIds: z.array(z.string()).optional().describe("Only work at these properties."),
  unitIds: z.array(z.string()).optional().describe("Only work at these units."),
  portfolioIds: z.array(z.string()).optional().describe("Only work in these portfolios."),
};

const window = {
  start: z.string().optional().describe("Only records from this date onwards, YYYY-MM-DD."),
  end: z.string().optional().describe("Only records up to this date, YYYY-MM-DD."),
};

export const maintenanceTools: ToolDefinition[] = [
  // ---- What tenants reported ----------------------------------------------------------------

  {
    name: "list_maintenance_requests",
    title: "List maintenance requests",
    description:
      "What tenants have reported as needing fixing, with urgency and status. Use for 'what is " +
      "broken', 'what came in this week', and finding a request to look into.",
    service: "maintenance",
    path: "maintenance-requests",
    paginated: true,
    schema: {
      ...window,
      propertyId: z.string().optional().describe("Only requests at this property."),
      unitId: z.string().optional().describe("Only requests at this unit."),
      portfolioId: z.string().optional().describe("Only requests in this portfolio."),
      leaseId: z.string().optional().describe("Only requests against this lease."),
      tenantId: z.string().optional().describe("Only requests raised by this tenant."),
      categoryId: z.string().optional().describe("Only requests in this category."),
      status: requestStatus,
      urgency: z
        .enum(["Urgent", "High", "Medium", "Low", "None"])
        .optional()
        .describe("Only requests at this urgency."),
      searchText: z.string().optional().describe("Free-text search of the request."),
      new: z.boolean().optional().describe("Only requests nobody has looked at yet when true."),
    },
  },
  {
    name: "get_maintenance_request",
    title: "Get a maintenance request",
    description:
      "One maintenance request in full — what was reported, by whom, its urgency, and the work " +
      "raised from it.",
    service: "maintenance",
    path: "maintenance-requests/{maintenanceRequestId}",
    schema: { maintenanceRequestId: z.string().describe("The request id, from list_maintenance_requests.") },
  },
  {
    name: "get_maintenance_request_history",
    title: "Get a request's history",
    description:
      "The timeline of one maintenance request — status changes and who made them. Use for " +
      "'what happened with this' and 'how long did it sit' questions.",
    service: "maintenance",
    path: "maintenance-requests/{maintenanceRequestId}/history",
    schema: { maintenanceRequestId: z.string().describe("The request id, from list_maintenance_requests.") },
  },
  {
    name: "get_maintenance_request_stats",
    title: "Get maintenance request statistics",
    description:
      "Counts of maintenance requests by state — the headline numbers, without listing them. Use " +
      "for 'how much is outstanding' questions.",
    service: "maintenance",
    path: "maintenance-requests/stats",
    schema: {},
  },
  {
    name: "list_maintenance_request_categories",
    title: "List maintenance categories",
    description:
      "The categories requests are filed under, such as plumbing or electrical. Use to find a " +
      "category id for filtering, or to explain how requests are classified.",
    service: "maintenance",
    path: "maintenance-requests/categories",
    schema: {},
  },

  // ---- The work itself ----------------------------------------------------------------------

  {
    name: "list_work_orders",
    title: "List work orders",
    description:
      "The work raised to fix things, with its status, vendor and schedule. Use for 'what work is " +
      "open', 'what is this vendor doing', and finding a work order to look into.",
    service: "maintenance",
    path: "work-orders",
    paginated: true,
    schema: {
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
    name: "get_work_order",
    title: "Get a work order",
    description:
      "One work order in full — what is being done, by whom, when, at what cost, and where it has " +
      "got to.",
    service: "maintenance",
    path: "work-orders/{workOrderId}",
    schema: { workOrderId: z.string().describe("The work order id, from list_work_orders.") },
  },
  {
    name: "get_work_order_history",
    title: "Get a work order's history",
    description:
      "The timeline of one work order — status changes, assignment and scheduling, and who did " +
      "each. Use for 'why is this taking so long' questions.",
    service: "maintenance",
    path: "work-orders/{workOrderId}/history",
    schema: { workOrderId: z.string().describe("The work order id, from list_work_orders.") },
  },
  {
    name: "list_work_order_schedule",
    title: "List scheduled work",
    description:
      "Work orders arranged by when they are booked in, the view used for planning a day or week. " +
      "Use for 'what is happening on Tuesday' questions.",
    service: "maintenance",
    path: "work-orders/schedule",
    schema: { ...place, ...window, status: workOrderStatus },
  },
  {
    name: "list_recurring_work_orders",
    title: "List recurring work orders",
    description:
      "Work that repeats on a schedule, such as quarterly servicing. Use to explain standing " +
      "maintenance as opposed to one-off jobs.",
    service: "maintenance",
    path: "work-orders/recurring",
    paginated: true,
    schema: {
      ...place,
      vendorIds: z.array(z.string()).optional().describe("Only recurring work for these vendors."),
      active: z.boolean().optional().describe("Only schedules still running when true."),
      search: z.string().optional().describe("Free-text search."),
    },
  },
  {
    name: "get_recurring_work_order",
    title: "Get a recurring work order",
    description: "One recurring work order — what repeats, how often, and who does it.",
    service: "maintenance",
    path: "work-orders/recurring/{recurringWorkOrderId}",
    schema: { recurringWorkOrderId: z.string().describe("The id, from list_recurring_work_orders.") },
  },
  {
    name: "get_recurring_work_order_stats",
    title: "Get recurring work statistics",
    description: "How a recurring work order has performed — how often it ran and what it cost.",
    service: "maintenance",
    path: "work-orders/recurring/{recurringWorkOrderId}/stats",
    schema: { recurringWorkOrderId: z.string().describe("The id, from list_recurring_work_orders.") },
  },

  // ---- Who does the work --------------------------------------------------------------------

  {
    name: "list_vendors",
    title: "List vendors",
    description:
      "The contractors and suppliers who do the work, with their trade and contact details. Use " +
      "to find a vendor id, or to answer 'who do we use for plumbing' questions.",
    service: "maintenance",
    path: "vendors",
    paginated: true,
    schema: {
      name: z.string().optional().describe("Match on vendor name."),
      categoryId: z.string().optional().describe("Only vendors in this trade category."),
      email: z.string().optional().describe("Match on email address."),
      phoneNumber: z.string().optional().describe("Match on phone number."),
      active: z.boolean().optional().describe("Only active vendors when true."),
      search: z.string().optional().describe("Free-text search across the vendor's details."),
    },
  },
  {
    name: "get_vendor",
    title: "Get a vendor",
    description: "One vendor in full — trade, contact details, insurance and how they are paid.",
    service: "maintenance",
    path: "vendors/{vendorId}",
    schema: { vendorId: z.string().describe("The vendor id, from list_vendors.") },
  },
  {
    name: "get_vendor_overview",
    title: "Get a vendor's overview",
    description:
      "A vendor's work at a glance — how much they have done and what it has cost. Use for " +
      "'how much do we spend with them' questions.",
    service: "maintenance",
    path: "vendors/{vendorId}/overview",
    schema: { vendorId: z.string().describe("The vendor id, from list_vendors.") },
  },
  {
    name: "get_vendor_custom_fields",
    title: "Get a vendor's custom fields",
    description: "The company-defined custom fields recorded against a vendor, and their values.",
    service: "maintenance",
    path: "vendors/{vendorId}/custom-fields",
    schema: { vendorId: z.string().describe("The vendor id, from list_vendors.") },
  },
  {
    name: "list_vendor_categories",
    title: "List vendor categories",
    description:
      "The trade categories vendors are grouped into. Use to find a category id for filtering " +
      "vendors or requests.",
    service: "maintenance",
    path: "vendors/categories",
    schema: {},
  },

  // ---- How the work should be done ----------------------------------------------------------

  {
    name: "list_run_books",
    title: "List run books",
    description:
      "The standing instructions for handling particular kinds of maintenance — who to call and " +
      "what to authorise. Use for 'what is our process for X' questions.",
    service: "maintenance",
    path: "run-books",
    paginated: true,
    schema: { title: z.string().optional().describe("Match on the run book's title.") },
  },
  {
    name: "get_run_book",
    title: "Get a run book",
    description: "One run book in full — its conditions and the actions it prescribes.",
    service: "maintenance",
    path: "run-books/{runBookId}",
    schema: { runBookId: z.string().describe("The run book id, from list_run_books.") },
  },
];
