/**
 * Everything readable about a lease: the lease itself, its money, its lifecycle and its paperwork.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

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

export const leaseTools: ToolDefinition[] = [
  {
    name: "list_leases",
    title: "List leases",
    description:
      "List leases with their term, rent and balance. Use for questions about who is renting what, " +
      "which leases carry a balance, and when terms start or end.",
    path: "leases",
    paginated: true,
    schema: {
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
    name: "get_lease",
    title: "Get a lease",
    description:
      "The full record for one lease — term, rent, tenants, unit and balances. Use when a question " +
      "is about a specific lease rather than finding one.",
    path: "leases/{leaseId}",
    schema: { leaseId },
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
    name: "get_lease_ledger",
    title: "Get the lease ledger",
    description:
      "The lease's transaction ledger: every charge, payment, credit, late fee and transfer with a " +
      "running balance. This is the tool for 'what do they owe', 'what have they paid', and any " +
      "question about money on a lease.",
    path: "leases/{leaseId}/charges/ledger",
    schema: {
      leaseId,
      limit: z.number().int().min(1).optional().describe("Most recent N entries. Omit for the full ledger."),
      asOf: z.string().optional().describe("Balance as at this date, YYYY-MM-DD. Omit for today."),
    },
  },
  {
    name: "get_lease_deposit_ledger",
    title: "Get the deposit ledger",
    description:
      "The lease's security deposit ledger — what was held, released or applied, with a running " +
      "balance. Separate from the charge ledger.",
    path: "leases/{leaseId}/deposits/ledger",
    schema: {
      leaseId,
      limit: z.number().int().min(1).optional().describe("Most recent N entries. Omit for the full ledger."),
      asOf: z.string().optional().describe("Balance as at this date, YYYY-MM-DD. Omit for today."),
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
    name: "list_lease_auto_pays",
    title: "List autopay arrangements",
    description:
      "The autopay arrangements tenants have set up on this lease — amount, schedule and account. " +
      "Use for 'is this tenant on autopay' questions.",
    path: "leases/{leaseId}/auto-pays",
    schema: { leaseId },
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
    name: "list_lease_renewal_offers",
    title: "List renewal offers for a lease",
    description: "The renewal offers made on one lease, with the terms offered and their status.",
    path: "leases/{leaseId}/renewals",
    paginated: true,
    schema: { leaseId },
  },
  {
    name: "list_lease_move_outs",
    title: "List move-outs for a lease",
    description:
      "The move-out records for one lease — notice date, expected and actual move-out dates, and " +
      "where the move-out has got to.",
    path: "leases/{leaseId}/move-outs",
    paginated: true,
    schema: { leaseId },
  },
  {
    name: "list_lease_subsidies",
    title: "List lease subsidies",
    description:
      "Subsidies on a lease — housing assistance paying part of the rent, and how much of the rent " +
      "the tenant is responsible for.",
    path: "leases/{leaseId}/subsidies",
    paginated: true,
    schema: { leaseId },
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
  {
    name: "list_lease_files",
    title: "List files attached to a lease",
    description:
      "Files attached to a lease, with their names and types. Metadata only — this does not return " +
      "file contents.",
    path: "leases/{leaseId}/files",
    schema: { leaseId },
  },
  {
    name: "get_lease_custom_fields",
    title: "Get a lease's custom fields",
    description: "The company-defined custom fields recorded against a lease, and their values.",
    path: "leases/{leaseId}/custom-fields",
    schema: { leaseId },
  },
];
