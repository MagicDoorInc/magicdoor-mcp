/**
 * Everything readable about a lease: the lease itself, its money, its lifecycle and its paperwork.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";
import { oneOrMany, selectPath } from "./shared.js";

const leaseId = z.string().describe("The lease id, as returned by list_leases.");

/** Each kind of ledger entry hangs off a different sub-path of the lease. */
const LEDGER_ENTRY_PATHS = {
  charge: "charges",
  payment: "charges/payments",
  credit: "charges/credits",
  lateFee: "charges/late-fees",
  transfer: "charges/transfers",
  deposit: "deposits",
} as const;

type LedgerEntryType = keyof typeof LEDGER_ENTRY_PATHS;

const RECURRING_PATHS = {
  charges: "recurring-charges",
  credits: "recurring-credits",
  payments: "recurring-payments",
} as const;

type RecurringType = keyof typeof RECURRING_PATHS;

const LEDGER_PATHS = { charges: "charges", deposits: "deposits" } as const;

/** Sub-resources of a lease that take nothing but the lease id. */
const RELATED_PATHS = {
  autoPays: "auto-pays",
  renewalOffers: "renewals",
  moveOuts: "move-outs",
  subsidies: "subsidies",
  files: "files",
  customFields: "custom-fields",
} as const;

export const leaseTools: ToolDefinition[] = [
  {
    name: "get_leases",
    title: "Leases",
    description:
      "Leases with their term, rent, tenants and balance. Pass leaseId for one in full; omit it to " +
      "list what matches the filters. Use for 'who is renting what', 'which leases carry a " +
      "balance', and finding a lease to look into.",
    ...oneOrMany("leaseId", "leases"),
    schema: {
      leaseId: z.string().optional().describe("Return just this lease, in full."),
      propertyId: z.string().optional().describe("Only leases on this property."),
      unitId: z.string().optional().describe("Only leases on this unit."),
      portfolioId: z.string().optional().describe("Only leases in this portfolio."),
      tenantIds: z.array(z.string()).optional().describe("Only leases involving these tenants."),
      monthToMonth: z.boolean().optional().describe("Only month-to-month leases when true."),
      eviction: z.boolean().optional().describe("Only leases in eviction when true."),
      withBalance: z.boolean().optional().describe("Only leases carrying a balance when true."),
    },
  },
  {
    name: "get_lease_ledger",
    title: "A lease's ledger",
    description:
      "A lease's transaction ledger with a running balance. The charges ledger holds every charge, " +
      "payment, credit, late fee and transfer; the deposits ledger holds security deposits held, " +
      "released or applied. This is the tool for 'what do they owe' and 'what have they paid'.",
    path: (args) => selectPath(LEDGER_PATHS, args.ledger, (segment) => `leases/{leaseId}/${segment}/ledger`),
    consumes: ["ledger"],
    schema: {
      leaseId,
      ledger: z.enum(["charges", "deposits"]).describe("Which ledger to read."),
      limit: z.number().int().min(1).optional().describe("Most recent N entries. Omit for the full ledger."),
      asOf: z.string().optional().describe("Balance as at this date, YYYY-MM-DD. Omit for today."),
    },
  },
  {
    name: "list_lease_related",
    title: "Things attached to a lease",
    description:
      "Records hanging off one lease: autopay arrangements tenants have set up, renewal offers " +
      "made, move-out records, housing subsidies paying part of the rent, attached files, or the " +
      "company-defined custom fields. Pick which with the type argument.",
    path: (args) => selectPath(RELATED_PATHS, args.type, (segment) => `leases/{leaseId}/${segment}`),
    consumes: ["type"],
    paginated: true,
    schema: {
      leaseId,
      type: z
        .enum(["autoPays", "renewalOffers", "moveOuts", "subsidies", "files", "customFields"])
        .describe("Which records attached to the lease to return."),
    },
  },
  {
    name: "list_expiring_leases",
    title: "List expiring leases",
    description:
      "Leases whose term is ending soon, the list a property manager works from when planning " +
      "renewals. Use for 'what is expiring' questions.",
    path: "leases/expiring",
    paginated: true,
    schema: {
      propertyId: z.string().optional().describe("Only leases on this property."),
      portfolioId: z.string().optional().describe("Only leases in this portfolio."),
    },
  },
  {
    name: "list_move_outs",
    title: "List move-outs",
    description:
      "Move-outs across the company, with their dates and status. Use for questions about who is " +
      "leaving and when, across the whole portfolio.",
    path: "leases/move-outs",
    paginated: true,
    schema: {
      propertyId: z.string().optional().describe("Only move-outs on this property."),
      portfolioId: z.string().optional().describe("Only move-outs in this portfolio."),
    },
  },
  {
    name: "get_lease_transaction",
    title: "Get one entry from a lease ledger",
    description:
      "One entry from a lease's ledger in full — a charge, payment, credit, late fee, transfer or " +
      "deposit. Take the id and its kind from get_lease_ledger or get_lease_deposit_ledger, then " +
      "use this to see everything about that entry.",
    path: (args) => {
      const segment = LEDGER_ENTRY_PATHS[args.type as LedgerEntryType];
      if (!segment) {
        throw new Error(`type must be one of: ${Object.keys(LEDGER_ENTRY_PATHS).join(", ")}.`);
      }

      return `leases/{leaseId}/${segment}/{transactionId}`;
    },
    consumes: ["type"],
    schema: {
      leaseId,
      transactionId: z.string().describe("The entry's id, from a ledger."),
      type: z
        .enum(["charge", "payment", "credit", "lateFee", "transfer", "deposit"])
        .describe("What kind of entry it is, as shown in the ledger it came from."),
    },
  },
  {
    name: "list_lease_recurring_items",
    title: "List what recurs on a lease",
    description:
      "The charges, credits or payments that apply automatically on a schedule. Use to explain " +
      "what a tenant is billed or credited each period, as opposed to what has already posted.",
    path: (args) => {
      const segment = RECURRING_PATHS[args.type as RecurringType];
      if (!segment) {
        throw new Error(`type must be one of: ${Object.keys(RECURRING_PATHS).join(", ")}.`);
      }

      return `leases/{leaseId}/charges/${segment}`;
    },
    consumes: ["type"],
    paginated: true,
    schema: {
      leaseId,
      type: z
        .enum(["charges", "credits", "payments"])
        .describe("Which kind of recurring item to list."),
    },
  },

  {
    name: "list_lease_renewals",
    title: "List lease renewals",
    description:
      "Lease renewals across the company — the record of a lease's term and rent changing. Use for " +
      "questions about upcoming or recent renewals and how rent moved.",
    path: "leases/renewals",
    paginated: true,
    schema: {},
  },
  {
    name: "list_lease_documents",
    title: "List lease documents",
    description:
      "Signed and pending lease documents, optionally narrowed to one lease. Use for questions " +
      "about whether a lease has been signed.",
    path: "lease-documents",
    paginated: true,
    schema: {
      leaseId: z.string().optional().describe("Only documents for this lease."),
      propertyId: z.string().optional().describe("Only documents for this property."),
      unitId: z.string().optional().describe("Only documents for this unit."),
      portfolioId: z.string().optional().describe("Only documents in this portfolio."),
    },
  },
];
