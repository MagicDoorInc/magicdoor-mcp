/**
 * The guard against a collapse quietly losing reach: every endpoint the server could ever call
 * is listed here, and the test drives the tool that should reach it and checks where it landed.
 * Removing a capability fails this file, not just the tool count.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startStub } from "./stub.js";
import { startServer } from "./client.js";

let portal;
let accounting;
let maintenance;
let mcp;

before(async () => {
  portal = await startStub();
  accounting = await startStub();
  maintenance = await startStub();
  mcp = startServer({
    MAGICDOOR_API_KEY: "magic_1_secret",
    MAGICDOOR_AUTH_URL: portal.url,
    MAGICDOOR_API_URL: portal.url,
    MAGICDOOR_ACCOUNTING_URL: accounting.url,
    MAGICDOOR_MAINTENANCE_URL: maintenance.url,
  });
  await mcp.handshake();
});

after(() => {
  mcp.stop();
  for (const stub of [portal, accounting, maintenance]) stub.server.close();
});

/** [tool, arguments, service, expected path] */
const ENDPOINTS = [
  // Portfolio
  ["list_properties", {}, "portal", "/company-app/properties"],
  ["list_units", {}, "portal", "/company-app/units"],
  ["list_tenants", {}, "portal", "/company-app/tenants"],
  ["list_owners", {}, "portal", "/company-app/owners"],

  // Leases
  ["get_leases", {}, "portal", "/company-app/leases"],
  ["get_leases", { leaseId: "L" }, "portal", "/company-app/leases/L"],
  ["list_expiring_leases", {}, "portal", "/company-app/leases/expiring"],
  ["list_move_outs", {}, "portal", "/company-app/leases/move-outs"],
  ["list_lease_renewals", {}, "portal", "/company-app/leases/renewals"],
  ["list_lease_documents", {}, "portal", "/company-app/lease-documents"],

  // Lease money
  ["get_lease_ledger", { leaseId: "L", ledger: "charges" }, "portal", "/company-app/leases/L/charges/ledger"],
  ["get_lease_ledger", { leaseId: "L", ledger: "deposits" }, "portal", "/company-app/leases/L/deposits/ledger"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "charge" }, "portal", "/company-app/leases/L/charges/T"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "payment" }, "portal", "/company-app/leases/L/charges/payments/T"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "credit" }, "portal", "/company-app/leases/L/charges/credits/T"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "lateFee" }, "portal", "/company-app/leases/L/charges/late-fees/T"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "transfer" }, "portal", "/company-app/leases/L/charges/transfers/T"],
  ["get_lease_transaction", { leaseId: "L", transactionId: "T", type: "deposit" }, "portal", "/company-app/leases/L/deposits/T"],
  ["list_lease_recurring_items", { leaseId: "L", type: "charges" }, "portal", "/company-app/leases/L/charges/recurring-charges"],
  ["list_lease_recurring_items", { leaseId: "L", type: "credits" }, "portal", "/company-app/leases/L/charges/recurring-credits"],
  ["list_lease_recurring_items", { leaseId: "L", type: "payments" }, "portal", "/company-app/leases/L/charges/recurring-payments"],

  // Lease sub-resources
  ["list_lease_related", { leaseId: "L", type: "autoPays" }, "portal", "/company-app/leases/L/auto-pays"],
  ["list_lease_related", { leaseId: "L", type: "renewalOffers" }, "portal", "/company-app/leases/L/renewals"],
  ["list_lease_related", { leaseId: "L", type: "moveOuts" }, "portal", "/company-app/leases/L/move-outs"],
  ["list_lease_related", { leaseId: "L", type: "subsidies" }, "portal", "/company-app/leases/L/subsidies"],
  ["list_lease_related", { leaseId: "L", type: "files" }, "portal", "/company-app/leases/L/files"],
  ["list_lease_related", { leaseId: "L", type: "customFields" }, "portal", "/company-app/leases/L/custom-fields"],

  // Chats
  ["list_chats", {}, "portal", "/company-app/chats"],
  ["get_chat", { chatId: "C" }, "portal", "/company-app/chats/C"],
  ["get_chat_messages", { chatId: "C" }, "portal", "/company-app/chats/C/messages"],
  ["list_unread_messages", {}, "portal", "/company-app/chats/unread-messages"],
  ["search_chat_messages", {}, "portal", "/company-app/chats/search"],

  // Accounting
  ["get_bank_accounts", {}, "accounting", "/company-portal/bank-accounts"],
  ["get_bank_accounts", { bankAccountId: "B" }, "accounting", "/company-portal/bank-accounts/B"],
  ["get_chart_of_accounts", {}, "accounting", "/company-portal/chart-of-accounts"],
  ["get_chart_of_accounts", { chartOfAccountId: "A" }, "accounting", "/company-portal/chart-of-accounts/A"],
  ["get_bank_ledger_transfers", {}, "accounting", "/company-portal/bank-ledger-transfers"],
  ["get_bank_ledger_transfers", { bankLedgerTransferId: "X" }, "accounting", "/company-portal/bank-ledger-transfers/X"],
  ["get_manual_journal_entries", {}, "accounting", "/company-portal/manual-journal-entries"],
  ["get_manual_journal_entries", { manualJournalEntryId: "J" }, "accounting", "/company-portal/manual-journal-entries/J"],
  ["get_transaction", { transactionId: "T" }, "accounting", "/company-portal/transactions/T"],
  ["list_deposit_slips", {}, "accounting", "/company-portal/deposit-slips"],

  // Reports
  ["get_financial_report", { report: "balanceSheet", basis: "Cash", reportType: "Company" }, "accounting", "/company-portal/reports/balance-sheet"],
  ["get_financial_report", { report: "incomeStatement", basis: "Cash", reportType: "Company" }, "accounting", "/company-portal/reports/income-statement"],
  ["get_financial_report", { report: "cashFlow", basis: "Cash", reportType: "Company" }, "accounting", "/company-portal/reports/cash-flow-statement"],
  ["get_financial_report", { report: "generalLedger", basis: "Cash", reportType: "Company" }, "accounting", "/company-portal/reports/general-ledger"],
  ["get_rent_payments_report", { "DateRange.Start": "2026-01-01", "DateRange.End": "2026-01-31" }, "accounting", "/company-portal/reports/rent-payments"],
  ["get_owner_statement", { startDate: "2026-01-01", endDate: "2026-01-31" }, "accounting", "/company-portal/reports/owner-statement"],
  ["get_accounting_summary", { summary: "onTimeRent" }, "accounting", "/company-portal/dashboard/on-time-rent"],
  ["get_accounting_summary", { summary: "onlinePayments" }, "accounting", "/company-portal/dashboard/online-payments"],
  ["get_accounting_summary", { summary: "dailyMoneyMovement" }, "accounting", "/company-portal/dashboard/daily-money-movement"],
  ["get_accounting_summary", { summary: "returnsAndDisputes" }, "accounting", "/company-portal/dashboard/returns-and-disputes"],

  // Maintenance
  ["get_maintenance_requests", {}, "maintenance", "/company-portal/maintenance-requests"],
  ["get_maintenance_requests", { maintenanceRequestId: "R" }, "maintenance", "/company-portal/maintenance-requests/R"],
  ["get_maintenance_request_stats", {}, "maintenance", "/company-portal/maintenance-requests/stats"],
  ["get_work_orders", {}, "maintenance", "/company-portal/work-orders"],
  ["get_work_orders", { workOrderId: "W" }, "maintenance", "/company-portal/work-orders/W"],
  ["get_work_order_schedule", {}, "maintenance", "/company-portal/work-orders/schedule"],
  ["get_maintenance_history", { type: "request", id: "R" }, "maintenance", "/company-portal/maintenance-requests/R/history"],
  ["get_maintenance_history", { type: "workOrder", id: "W" }, "maintenance", "/company-portal/work-orders/W/history"],
  ["get_recurring_work_orders", {}, "maintenance", "/company-portal/work-orders/recurring"],
  ["get_recurring_work_orders", { recurringWorkOrderId: "V" }, "maintenance", "/company-portal/work-orders/recurring/V"],
  ["get_recurring_work_order_stats", { recurringWorkOrderId: "V" }, "maintenance", "/company-portal/work-orders/recurring/V/stats"],
  ["get_vendors", {}, "maintenance", "/company-portal/vendors"],
  ["get_vendors", { vendorId: "D" }, "maintenance", "/company-portal/vendors/D"],
  ["get_vendor_detail", { vendorId: "D", detail: "overview" }, "maintenance", "/company-portal/vendors/D/overview"],
  ["get_vendor_detail", { vendorId: "D", detail: "customFields" }, "maintenance", "/company-portal/vendors/D/custom-fields"],
  ["list_maintenance_categories", { type: "request" }, "maintenance", "/company-portal/maintenance-requests/categories"],
  ["list_maintenance_categories", { type: "vendor" }, "maintenance", "/company-portal/vendors/categories"],
  ["get_run_books", {}, "maintenance", "/company-portal/run-books"],
  ["get_run_books", { runBookId: "K" }, "maintenance", "/company-portal/run-books/K"],
];

describe("endpoint coverage", () => {
  const stubs = () => ({ portal, accounting, maintenance });

  for (const [tool, args, service, expected] of ENDPOINTS) {
    test(`${tool}(${JSON.stringify(args)}) -> ${expected}`, async () => {
      const stub = stubs()[service];
      const { result } = await mcp.call("tools/call", { name: tool, arguments: args });

      assert.equal(result.isError ?? false, false, result.content?.[0]?.text);
      assert.equal(stub.requests.at(-1).path, expected);
    });
  }

  test("covers every endpoint the tools can reach", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const exercised = new Set(ENDPOINTS.map(([tool]) => tool));

    for (const tool of tools) {
      assert.ok(exercised.has(tool.name), `${tool.name} is not covered by an endpoint assertion`);
    }
  });

  test("fetching one record does not ask for a page of them", async () => {
    await mcp.call("tools/call", { name: "get_vendors", arguments: { vendorId: "D" } });
    assert.deepEqual(Object.keys(maintenance.requests.at(-1).query), []);

    await mcp.call("tools/call", { name: "get_vendors", arguments: {} });
    assert.equal(maintenance.requests.at(-1).query.pageSize, "25");
  });
});
