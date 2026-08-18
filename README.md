# MagicDoor MCP server

Lets an AI assistant read your MagicDoor portfolio — properties, units, leases, tenants, owners
and lease renewals — using an API key you create and can revoke at any time.

It runs on your own machine. Nothing is hosted, and your key never leaves your computer except to
MagicDoor itself.

## Setup

**1. Create an API key** in MagicDoor under Settings → API keys. Choose the permissions the
assistant should have — `properties:read`, `units:read`, `leases:read`, `tenants:read` and
`owners:read` are enough for everything here. The key is shown once; copy it.

**2. Add the server** to your assistant's MCP configuration:

```json
{
  "mcpServers": {
    "magicdoor": {
      "command": "npx",
      "args": ["-y", "@magicdoor/mcp"],
      "env": { "MAGICDOOR_API_KEY": "magic_0_EXAMPLE-NOT-A-REAL-KEY" }
    }
  }
}
```

For Claude Code, `claude mcp add magicdoor -e MAGICDOOR_API_KEY=magic_… -- npx -y @magicdoor/mcp`
does the same thing.

**3. Restart the assistant.** Ask it something like *"how many units do we have in the Oak Street
property?"*

## Tools

**Portfolio**

| Tool | Answers questions like |
|---|---|
| `list_properties` / `list_units` | What's in the portfolio? How many units does this property have? |
| `list_tenants` / `list_owners` | Who lives where? Who owns what? How do I reach them? |

**Leases** — several tools take an id for one record, or filters for a list.

| Tool | Answers questions like |
|---|---|
| `get_leases` | Who's renting what? Which leases carry a balance? One lease in full. |
| `get_lease_ledger` | What do they owe, what have they paid — charges or deposits. |
| `get_lease_transaction` | One ledger entry: charge, payment, credit, late fee, transfer or deposit. |
| `list_lease_recurring_items` | What's billed or credited each period, rather than what has posted. |
| `list_lease_related` | Autopay, renewal offers, move-outs, subsidies, files or custom fields for a lease. |
| `list_expiring_leases` / `list_move_outs` / `list_lease_renewals` | What's ending, who's leaving, what renewed. |
| `list_lease_documents` | Has the lease been signed? |

**Conversations**

| Tool | Answers questions like |
|---|---|
| `list_chats` / `get_chat` / `get_chat_messages` | What are people asking about, and what was said? |
| `list_unread_messages` / `search_chat_messages` | What needs a response? Did anyone mention the boiler? |

**Accounting**

| Tool | Answers questions like |
|---|---|
| `get_bank_accounts` / `get_chart_of_accounts` | What accounts do we hold? How are the books structured? |
| `get_transaction` / `get_bank_ledger_transfers` / `get_manual_journal_entries` | What was this? What moved? What was adjusted by hand? |
| `list_deposit_slips` | Which payments were banked together? |
| `get_financial_report` | Balance sheet, income statement, cash flow or general ledger. |
| `get_rent_payments_report` / `get_owner_statement` | What rent came in? What does this owner get? |
| `get_accounting_summary` | On-time rent, online payments, daily money movement, returns and disputes. |

**Maintenance**

| Tool | Answers questions like |
|---|---|
| `get_maintenance_requests` | What's broken? What came in this week? One request in full. |
| `get_work_orders` / `get_work_order_schedule` | What work is open? What's happening on Tuesday? |
| `get_maintenance_history` | What happened with this, and why is it taking so long? |
| `get_recurring_work_orders` / `get_recurring_work_order_stats` | What repeats, how often, at what cost? |
| `get_vendors` / `get_vendor_detail` | Who do we use for plumbing? How much do we spend with them? |
| `list_maintenance_categories` / `get_run_books` | How is work classified? What's our process? |
| `get_maintenance_request_stats` | How much is outstanding? |

**Every tool is read-only.** There is no way to create, change or delete anything in MagicDoor
through this server, by design.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MAGICDOOR_API_KEY` | yes | — | The key you created in MagicDoor. |
| `MAGICDOOR_ENV` | no | `production` | `production`, `staging`, `demo` or `development`. |
| `MAGICDOOR_AUTH_URL` | no | from `MAGICDOOR_ENV` | Override the auth host, for local development. |
| `MAGICDOOR_API_URL` | no | from `MAGICDOOR_ENV` | Override the portal API host, for local development. |
| `MAGICDOOR_ACCOUNTING_URL` | no | from `MAGICDOOR_ENV` | Override the accounting host, for local development. |
| `MAGICDOOR_MAINTENANCE_URL` | no | from `MAGICDOOR_ENV` | Override the maintenance host, for local development. |

## How access works

The API key is long-lived; the tokens it produces are not. On the first tool call the server
exchanges your key for a 15-minute access token, keeps it in memory, and renews it a minute
before it expires. There is no refresh token — the key itself is the durable credential.

Two things follow, and both are deliberate:

- **Revoking the key stops this server immediately.** There is no session to expire.
- **Narrowing your own MagicDoor permissions narrows the key too.** Permissions are re-checked
  every time a token is issued, so a key can never do more than you can right now.

## Releasing

```bash
npm version patch                  # or minor, or major
NPM_TOKEN=npm_xxx ./publish.sh
```

npm will not publish without a second factor. Create a granular access token at
npmjs.com → Access Tokens → Generate New Token → Granular Access Token, with **Bypass 2FA**
ticked and read/write limited to the `@magicdoor` scope, and pass it as `NPM_TOKEN`. It cannot
touch anything outside that scope even if it leaks. If you have 2FA set up instead, pass the
code: `./publish.sh 123456`.

`publish.sh` refuses to run on a dirty tree or a version that is already on npm, checks types,
runs the tests, then publishes.

## Development

```bash
npm install
npm run build
MAGICDOOR_API_KEY=magic_… MAGICDOOR_ENV=development node dist/index.js
```

The server speaks MCP over stdio, so it expects a client on the other end rather than a terminal.
`npx @modelcontextprotocol/inspector node dist/index.js` gives you one to poke at it with.
