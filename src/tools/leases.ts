/**
 * Everything readable about a lease: the lease itself, its money, its lifecycle and its paperwork.
 */
import { z } from "zod";
import type { ToolDefinition } from "../registry.js";

const leaseId = z.string().describe("The lease id, as returned by list_leases.");

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
    name: "get_lease_charge",
    title: "Get a charge",
    description: "One charge on a lease in full, including how much of it has been settled.",
    path: "leases/{leaseId}/charges/{chargeId}",
    schema: { leaseId, chargeId: z.string().describe("The charge id, from the lease ledger.") },
  },
  {
    name: "get_lease_payment",
    title: "Get a payment",
    description: "One payment against a lease in full, including what it was applied to.",
    path: "leases/{leaseId}/charges/payments/{paymentId}",
    schema: { leaseId, paymentId: z.string().describe("The payment id, from the lease ledger.") },
  },
  {
    name: "get_lease_credit",
    title: "Get a credit",
    description:
      "One credit issued against a lease in full — the amount, the reason it was given, and what it " +
      "was applied to.",
    path: "leases/{leaseId}/charges/credits/{creditId}",
    schema: { leaseId, creditId: z.string().describe("The credit id, from the lease ledger.") },
  },
  {
    name: "get_lease_late_fee",
    title: "Get a late fee",
    description:
      "One late fee charged on a lease — the amount, when it was applied, and the overdue charge " +
      "that triggered it.",
    path: "leases/{leaseId}/charges/late-fees/{lateFeeId}",
    schema: { leaseId, lateFeeId: z.string().describe("The late fee id, from the lease ledger.") },
  },
  {
    name: "get_lease_transfer",
    title: "Get a transfer",
    description: "One ledger transfer on a lease, moving money between the lease and elsewhere.",
    path: "leases/{leaseId}/charges/transfers/{transferId}",
    schema: { leaseId, transferId: z.string().describe("The transfer id, from the lease ledger.") },
  },
  {
    name: "get_lease_deposit",
    title: "Get a deposit",
    description:
      "One security deposit held against a lease — the amount held, and whether any of it has been " +
      "released or applied.",
    path: "leases/{leaseId}/deposits/{depositId}",
    schema: { leaseId, depositId: z.string().describe("The deposit id, from the deposit ledger.") },
  },
  {
    name: "list_lease_recurring_charges",
    title: "List recurring charges",
    description:
      "The charges that post automatically on a schedule — rent and any recurring add-ons. Use to " +
      "explain what a tenant is billed each period, as opposed to what has already posted.",
    path: "leases/{leaseId}/charges/recurring-charges",
    paginated: true,
    schema: { leaseId },
  },
  {
    name: "list_lease_recurring_credits",
    title: "List recurring credits",
    description: "Credits that apply automatically on a schedule, such as a standing concession.",
    path: "leases/{leaseId}/charges/recurring-credits",
    paginated: true,
    schema: { leaseId },
  },
  {
    name: "list_lease_recurring_payments",
    title: "List recurring payments",
    description: "Payments scheduled to be taken automatically, separate from tenant-run autopay.",
    path: "leases/{leaseId}/charges/recurring-payments",
    paginated: true,
    schema: { leaseId },
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
