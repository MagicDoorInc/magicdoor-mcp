import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { startStub } from "./stub.js";
import { startServer } from "./client.js";

const API_KEY = "magic_7412996891234_Xk3nQv8mWp2sT5yR9dL4bN6hJ1kF3gZ7xC0vQ8aE";

let stub;
let accountingStub;
let maintenanceStub;
let mcp;

before(async () => {
  stub = await startStub();
  accountingStub = await startStub();
  maintenanceStub = await startStub();
  mcp = startServer({
    MAGICDOOR_API_KEY: API_KEY,
    MAGICDOOR_AUTH_URL: stub.url,
    MAGICDOOR_API_URL: stub.url,
    MAGICDOOR_ACCOUNTING_URL: accountingStub.url,
    MAGICDOOR_MAINTENANCE_URL: maintenanceStub.url,
  });
  await mcp.handshake();
});

after(() => {
  mcp.stop();
  stub.server.close();
  accountingStub.server.close();
  maintenanceStub.server.close();
});

const callTool = async (name, args = {}) => {
  const response = await mcp.call("tools/call", { name, arguments: args });
  return response.result;
};

describe("tool surface", () => {
  test("advertises every read tool", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const names = tools.map((tool) => tool.name);
    assert.equal(new Set(names).size, names.length, "tool names must be unique");
    for (const expected of [
      "list_properties", "list_units", "list_tenants", "list_owners",
      "list_leases", "get_lease", "get_lease_ledger",
      "list_bank_accounts", "list_chart_of_accounts", "get_transaction", "get_balance_sheet",
      "list_maintenance_requests", "list_work_orders", "list_vendors", "get_work_order_history",
      "list_chats", "get_chat_messages", "list_unread_messages", "search_chat_messages",
    ]) {
      assert.ok(names.includes(expected), `missing ${expected}`);
    }
  });

  test("publishes the filters each tool accepts", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const properties = tools.find((tool) => tool.name === "list_properties");
    assert.deepEqual(
      Object.keys(properties.inputSchema.properties).sort(),
      ["active", "name", "ownerId", "page", "pageSize", "portfolioId", "search"],
    );
  });

  test("every tool is described for the model", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    for (const tool of tools) {
      assert.ok(tool.description.length > 60, `${tool.name} needs a description a model can act on`);
    }
  });
});

describe("calling MagicDoor", () => {
  test("returns the API payload as text", async () => {
    const result = await callTool("list_properties", { search: "oak", pageSize: 10 });
    assert.equal(result.isError ?? false, false);
    assert.equal(JSON.parse(result.content[0].text).items[0].name, "Test Property");
  });

  test("targets the company-app area and passes filters through", async () => {
    await callTool("list_properties", { search: "oak", pageSize: 10 });
    const request = stub.requests.at(-1);
    assert.equal(request.path, "/company-app/properties");
    assert.equal(request.query.search, "oak");
    assert.equal(request.query.pageSize, "10");
  });

  test("defaults to a modest page size", async () => {
    await callTool("list_tenants");
    assert.equal(stub.requests.at(-1).query.pageSize, "25");
  });

  test("omits filters that were not supplied", async () => {
    await callTool("list_units", { propertyId: "42" });
    const keys = Object.keys(stub.requests.at(-1).query).sort();
    assert.deepEqual(keys, ["pageSize", "propertyId"]);
  });

  test("repeats a parameter for each entry of a list filter", async () => {
    await callTool("list_leases", { tenantIds: ["1", "2"] });
    const tenantIds = stub.requests.at(-1).all.filter(([key]) => key === "tenantIds").map(([, value]) => value);
    assert.deepEqual(tenantIds, ["1", "2"]);
  });
});

describe("access tokens", () => {
  test("exchanges the API key for a bearer token", async () => {
    await callTool("list_properties");
    assert.deepEqual(stub.tokenCalls[0], { key: API_KEY });
    assert.match(stub.requests.at(-1).auth, /^Bearer /);
  });

  test("reuses the token across calls rather than exchanging each time", async () => {
    const before = stub.tokenCalls.length;
    await callTool("list_properties");
    await callTool("list_owners");
    assert.equal(stub.tokenCalls.length, before);
  });

  test("renews once and retries when the token is rejected mid-call", async () => {
    const before = stub.tokenCalls.length;
    stub.state.failNext401 = true;

    const result = await callTool("list_leases");

    assert.equal(result.isError ?? false, false, "the retry should succeed");
    assert.equal(stub.tokenCalls.length, before + 1, "exactly one fresh exchange");
  });
});

describe("failures the user has to act on", () => {
  test("explains a rejected key instead of failing silently", async () => {
    // A fresh server, because the shared one already holds a valid token and would never
    // attempt the exchange that gets rejected.
    stub.state.rejectKey = true;
    const server = startServer({
      MAGICDOOR_API_KEY: API_KEY,
      MAGICDOOR_AUTH_URL: stub.url,
      MAGICDOOR_API_URL: stub.url,
    });
    await server.handshake();

    const { result } = await server.call("tools/call", { name: "list_properties", arguments: {} });

    server.stop();
    stub.state.rejectKey = false;

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /revoked, expired, mistyped/);
  });

  test("refuses to start without an API key", async () => {
    const server = startServer({ MAGICDOOR_API_KEY: "", MAGICDOOR_AUTH_URL: stub.url, MAGICDOOR_API_URL: stub.url });
    await server.exited();
    assert.match(server.stderr(), /MAGICDOOR_API_KEY is not set/);
  });

  test("rejects an unknown environment by name", async () => {
    const server = startServer({ MAGICDOOR_API_KEY: API_KEY, MAGICDOOR_ENV: "prod", MAGICDOOR_AUTH_URL: "", MAGICDOOR_API_URL: "" });
    await server.exited();
    assert.match(server.stderr(), /not a MagicDoor environment/);
  });
});

describe("lease coverage", () => {
  test("substitutes path parameters instead of sending them as query", async () => {
    await callTool("get_lease_ledger", { leaseId: "7412", limit: 5 });
    const request = stub.requests.at(-1);
    assert.equal(request.path, "/company-app/leases/7412/charges/ledger");
    assert.deepEqual(Object.keys(request.query), ["limit"]);
  });

  test("reaches every ledger entry kind through one tool", async () => {
    const expected = {
      charge: "/company-app/leases/7412/charges/99",
      payment: "/company-app/leases/7412/charges/payments/99",
      credit: "/company-app/leases/7412/charges/credits/99",
      lateFee: "/company-app/leases/7412/charges/late-fees/99",
      transfer: "/company-app/leases/7412/charges/transfers/99",
      deposit: "/company-app/leases/7412/deposits/99",
    };

    for (const [type, path] of Object.entries(expected)) {
      await callTool("get_lease_transaction", { leaseId: "7412", transactionId: "99", type });
      assert.equal(stub.requests.at(-1).path, path, `${type} went to the wrong endpoint`);
      assert.deepEqual(Object.keys(stub.requests.at(-1).query), [], `${type} leaked its selector`);
    }
  });

  test("reaches every recurring kind through one tool", async () => {
    for (const [type, segment] of Object.entries({
      charges: "recurring-charges", credits: "recurring-credits", payments: "recurring-payments",
    })) {
      await callTool("list_lease_recurring_items", { leaseId: "7412", type });
      assert.equal(stub.requests.at(-1).path, `/company-app/leases/7412/charges/${segment}`);
    }
  });

  test("does not page endpoints that return a single record", async () => {
    await callTool("get_lease", { leaseId: "7412" });
    assert.deepEqual(Object.keys(stub.requests.at(-1).query), []);
  });

  test("still pages the list endpoints", async () => {
    await callTool("list_lease_renewal_offers", { leaseId: "7412" });
    assert.equal(stub.requests.at(-1).query.pageSize, "25");
  });

  test("reports a missing lease id rather than calling a broken path", async () => {
    const result = await callTool("get_lease_ledger", { leaseId: "" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /leaseId is required/);
  });

  test("covers the lease surface a property manager asks about", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const names = new Set(tools.map((tool) => tool.name));
    for (const expected of [
      "get_lease", "get_lease_ledger", "get_lease_deposit_ledger", "get_lease_transaction",
      "list_lease_recurring_items", "list_lease_auto_pays", "list_lease_renewal_offers",
      "list_lease_subsidies", "list_lease_documents",
    ]) {
      assert.ok(names.has(expected), `missing ${expected}`);
    }
  });

  test("exposes no way to write", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    for (const tool of tools) {
      assert.match(tool.name, /^(list|get|search)_/, `${tool.name} is not a read`);
    }
  });
});

describe("accounting", () => {
  test("routes accounting tools to the accounting service, not the portal", async () => {
    const before = stub.requests.length;
    await callTool("list_bank_accounts", {});

    assert.equal(stub.requests.length, before, "must not hit the portal");
    assert.equal(accountingStub.requests.at(-1).path, "/company-portal/bank-accounts");
  });

  test("keeps portal tools on the portal service", async () => {
    const before = accountingStub.requests.length;
    await callTool("list_properties", {});

    assert.equal(accountingStub.requests.length, before, "must not hit accounting");
    assert.equal(stub.requests.at(-1).path, "/company-app/properties");
  });

  test("uses one access token across both services", async () => {
    await callTool("list_properties", {});
    await callTool("list_bank_accounts", {});

    assert.equal(stub.requests.at(-1).auth, accountingStub.requests.at(-1).auth);
  });

  test("passes report parameters through", async () => {
    await callTool("get_income_statement", {
      basis: "Accrual", reportType: "Property", startDate: "2026-01-01", endDate: "2026-01-31",
      propertyIds: ["7", "9"],
    });

    const request = accountingStub.requests.at(-1);
    assert.equal(request.path, "/company-portal/reports/income-statement");
    assert.equal(request.query.basis, "Accrual");
    assert.equal(request.query.startDate, "2026-01-01");
    assert.deepEqual(
      request.all.filter(([key]) => key === "propertyIds").map(([, value]) => value),
      ["7", "9"],
    );
  });

  test("rejects an accounting basis the API would not understand", async () => {
    const result = await callTool("get_balance_sheet", { basis: "Modified", reportType: "Company" });
    assert.equal(result.isError ?? false, true);
  });
});

describe("maintenance", () => {
  test("routes maintenance tools to the maintenance service", async () => {
    const portalBefore = stub.requests.length;
    const accountingBefore = accountingStub.requests.length;

    await callTool("list_work_orders", {});

    assert.equal(stub.requests.length, portalBefore, "must not hit the portal");
    assert.equal(accountingStub.requests.length, accountingBefore, "must not hit accounting");
    assert.equal(maintenanceStub.requests.at(-1).path, "/company-portal/work-orders");
  });

  test("builds nested maintenance paths", async () => {
    await callTool("get_recurring_work_order_stats", { recurringWorkOrderId: "88" });
    assert.equal(maintenanceStub.requests.at(-1).path, "/company-portal/work-orders/recurring/88/stats");
  });

  test("passes status filters as repeated parameters", async () => {
    await callTool("list_work_orders", { status: ["Pending", "InProgress"] });
    const statuses = maintenanceStub.requests
      .at(-1)
      .all.filter(([key]) => key === "status")
      .map(([, value]) => value);
    assert.deepEqual(statuses, ["Pending", "InProgress"]);
  });

  test("rejects a status the API would not understand", async () => {
    const result = await callTool("list_work_orders", { status: ["Started"] });
    assert.equal(result.isError ?? false, true);
  });

  test("all three services share one access token", async () => {
    await callTool("list_properties", {});
    await callTool("list_bank_accounts", {});
    await callTool("list_vendors", {});

    const token = stub.requests.at(-1).auth;
    assert.equal(accountingStub.requests.at(-1).auth, token);
    assert.equal(maintenanceStub.requests.at(-1).auth, token);
  });
});

describe("chats", () => {
  test("reads a conversation's messages from the portal", async () => {
    await callTool("get_chat_messages", { chatId: "5150", take: 20, search: "leak" });

    const request = stub.requests.at(-1);
    assert.equal(request.path, "/company-app/chats/5150/messages");
    assert.equal(request.query.take, "20");
    assert.equal(request.query.search, "leak");
  });

  test("does not page a chat listing the API returns whole", async () => {
    await callTool("list_chats", { closed: false });
    assert.deepEqual(Object.keys(stub.requests.at(-1).query), ["closed"]);
  });

  test("pages the message searches", async () => {
    await callTool("search_chat_messages", { search: "boiler" });
    assert.equal(stub.requests.at(-1).query.pageSize, "25");
  });
});

describe("collapsed tools", () => {
  test("reaches every dashboard figure through one tool", async () => {
    for (const [summary, segment] of Object.entries({
      onTimeRent: "on-time-rent", onlinePayments: "online-payments",
      dailyMoneyMovement: "daily-money-movement", returnsAndDisputes: "returns-and-disputes",
    })) {
      await callTool("get_accounting_summary", { summary });
      assert.equal(accountingStub.requests.at(-1).path, `/company-portal/dashboard/${segment}`);
      assert.deepEqual(Object.keys(accountingStub.requests.at(-1).query), []);
    }
  });

  test("rejects a selector that maps to no endpoint", async () => {
    const result = await callTool("get_lease_transaction", {
      leaseId: "1", transactionId: "2", type: "refund",
    });
    assert.equal(result.isError, true);
  });

  test("the collapsed tools did not shrink what is reachable", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const names = tools.map((tool) => tool.name);

    for (const gone of [
      "get_lease_charge", "get_lease_payment", "get_lease_credit", "get_lease_late_fee",
      "get_lease_transfer", "get_lease_deposit", "list_lease_recurring_charges",
      "get_on_time_rent_summary", "get_returns_and_disputes",
    ]) {
      assert.ok(!names.includes(gone), `${gone} should have been folded in`);
    }

    for (const replacement of [
      "get_lease_transaction", "list_lease_recurring_items", "get_accounting_summary",
    ]) {
      assert.ok(names.includes(replacement), `missing ${replacement}`);
    }
  });
});
