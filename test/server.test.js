/**
 * How the server behaves: the protocol handshake, how it builds requests, how it handles tokens,
 * and what it does when something goes wrong. Which endpoint each tool reaches is asserted
 * separately, in coverage.test.js.
 */
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
  for (const server of [stub, accountingStub, maintenanceStub]) server.server.close();
});

const callTool = async (name, args = {}) =>
  (await mcp.call("tools/call", { name, arguments: args })).result;

describe("tool surface", () => {
  test("names are unique and describe a read", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    const names = tools.map((tool) => tool.name);

    assert.equal(new Set(names).size, names.length);
    for (const name of names) {
      assert.match(name, /^(list|get|search)_/, `${name} is not a read`);
    }
  });

  test("stays small enough for a model to choose well", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    assert.ok(tools.length <= 45, `${tools.length} tools is past the point where selection degrades`);
  });

  test("every tool is described well enough to pick", async () => {
    const { tools } = (await mcp.call("tools/list")).result;
    for (const tool of tools) {
      assert.ok(tool.description.length > 60, `${tool.name} needs a description a model can act on`);
    }
  });
});

describe("building requests", () => {
  test("returns the API payload as text", async () => {
    const result = await callTool("list_properties", { search: "oak", pageSize: 10 });
    assert.equal(result.isError ?? false, false);
    assert.equal(JSON.parse(result.content[0].text).items[0].name, "Test Property");
  });

  test("passes filters through and defaults the page size", async () => {
    await callTool("list_properties", { search: "oak" });
    assert.equal(stub.requests.at(-1).query.search, "oak");
    assert.equal(stub.requests.at(-1).query.pageSize, "25");
  });

  test("omits filters that were not supplied", async () => {
    await callTool("list_units", { propertyId: "42" });
    assert.deepEqual(Object.keys(stub.requests.at(-1).query).sort(), ["pageSize", "propertyId"]);
  });

  test("repeats a parameter for each entry of a list filter", async () => {
    await callTool("get_leases", { tenantIds: ["1", "2"] });
    const values = stub.requests.at(-1).all.filter(([key]) => key === "tenantIds").map(([, value]) => value);
    assert.deepEqual(values, ["1", "2"]);
  });

  test("does not leak the argument that selected an endpoint", async () => {
    await callTool("get_lease_transaction", { leaseId: "7412", transactionId: "99", type: "payment" });
    assert.deepEqual(Object.keys(stub.requests.at(-1).query), []);
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

  test("one token serves all three services", async () => {
    await callTool("list_properties");
    await callTool("get_bank_accounts");
    await callTool("get_vendors");

    const token = stub.requests.at(-1).auth;
    assert.equal(accountingStub.requests.at(-1).auth, token);
    assert.equal(maintenanceStub.requests.at(-1).auth, token);
  });

  test("renews once and retries when the token is rejected mid-call", async () => {
    const before = stub.tokenCalls.length;
    stub.state.failNext401 = true;

    const result = await callTool("get_leases");

    assert.equal(result.isError ?? false, false, "the retry should succeed");
    assert.equal(stub.tokenCalls.length, before + 1, "exactly one fresh exchange");
  });
});

describe("failures the user has to act on", () => {
  test("reports a missing path argument rather than calling a broken URL", async () => {
    const result = await callTool("get_lease_ledger", { leaseId: "", ledger: "charges" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /leaseId is required/);
  });

  test("rejects a selector that maps to no endpoint", async () => {
    const result = await callTool("get_lease_transaction", { leaseId: "1", transactionId: "2", type: "refund" });
    assert.equal(result.isError, true);
  });

  test("rejects a filter value the API would not understand", async () => {
    const result = await callTool("get_work_orders", { status: ["Started"] });
    assert.equal(result.isError ?? false, true);
  });

  test("explains a rejected key instead of failing silently", async () => {
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

describe("keeping responses usable", () => {
  test("summarises the chat listing instead of returning every chat whole", async () => {
    stub.setResponse("/company-app/chats", {
      chats: Array.from({ length: 400 }, (_, i) => ({
        id: String(i), subject: `Chat ${i}`, type: "Lease", closed: false,
        participants: Array.from({ length: 4 }, (_, p) => ({ id: p, name: "x".repeat(200) })),
        latestMessage: { message: "y".repeat(2000) },
      })),
    });

    const result = await callTool("list_chats", {});
    const payload = JSON.parse(result.content[0].text);

    assert.equal(payload.chats.length, 25, "caps the listing");
    assert.equal(payload.totalCount, 400, "still reports how many exist");
    assert.equal(payload.omitted, 375);
    assert.match(payload.note, /Showing 25 of 400/);
    assert.ok(result.content[0].text.length < 20_000, "must not be enormous");
    assert.equal(payload.chats[0].participantCount, 4, "participants become a count");
    assert.ok(payload.chats[0].latestMessagePreview.length <= 140, "the latest message is a preview");
  });

  test("honours a raised chat limit", async () => {
    const result = await callTool("list_chats", { limit: 60 });
    assert.equal(JSON.parse(result.content[0].text).chats.length, 60);
  });

  test("caps the work order schedule", async () => {
    maintenanceStub.setResponse("/company-portal/work-orders/schedule", {
      items: Array.from({ length: 300 }, (_, i) => ({ id: String(i) })),
    });

    const payload = JSON.parse((await callTool("get_work_order_schedule", {})).content[0].text);
    assert.equal(payload.items.length, 50);
    assert.equal(payload.totalCount, 300);
    assert.match(payload.note, /Showing 50 of 300/);
  });

  test("truncates any response that would still swamp the context", async () => {
    stub.setResponse("/company-app/properties", { items: [{ blob: "z".repeat(400_000) }] });

    const text = (await callTool("list_properties", {})).content[0].text;
    assert.ok(text.length < 210_000, "guard should cut it down");
    assert.match(text, /truncated at 200000 characters/);
  });
});
