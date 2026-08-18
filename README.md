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
      "env": { "MAGICDOOR_API_KEY": "magic_7412996891234_Xk3nQv…" }
    }
  }
}
```

For Claude Code, `claude mcp add magicdoor --env MAGICDOOR_API_KEY=magic_… -- npx -y @magicdoor/mcp`
does the same thing.

**3. Restart the assistant.** Ask it something like *"how many units do we have in the Oak Street
property?"*

## Tools

**Portfolio**

| Tool | Answers questions like |
|---|---|
| `list_properties` | What's in the portfolio? Which properties does this owner have? |
| `list_units` | How many units does this property have? Which are active? |
| `list_tenants` | Who lives where, and how do I reach them? |
| `list_owners` | Who owns which properties? |

**Leases**

| Tool | Answers questions like |
|---|---|
| `list_leases` | Who's renting what? Which leases carry a balance? |
| `get_lease` | Everything about one lease. |
| `list_expiring_leases` | What's ending soon? |
| `list_move_outs` | Who's leaving, and when? |

**Money on a lease**

| Tool | Answers questions like |
|---|---|
| `get_lease_ledger` | What do they owe? What have they paid? |
| `get_lease_deposit_ledger` | What deposit is held, and what's been released? |
| `get_lease_transaction` | Drill into one ledger entry — charge, payment, credit, late fee, transfer or deposit. |
| `list_lease_recurring_items` | What is billed or credited each period, as opposed to what has posted? |
| `list_lease_auto_pays` | Is this tenant on autopay? |

**Lifecycle and paperwork**

| Tool | Answers questions like |
|---|---|
| `list_lease_renewals` | Which leases renewed, and how did rent move? |
| `list_lease_renewal_offers` | What was offered on this lease? |
| `list_lease_move_outs` | Where has this move-out got to? |
| `list_lease_subsidies` | Who pays what share of the rent? |
| `list_lease_documents` | Has the lease been signed? |
| `list_lease_files` / `get_lease_custom_fields` | What else is recorded against this lease? |

**Accounting** *(served by MagicDoor's accounting service)*

| Tool | Answers questions like |
|---|---|
| `list_bank_accounts` / `get_bank_account` | What accounts do we hold, and what's in them? |
| `list_chart_of_accounts` / `get_chart_of_account` | How are the books structured? |
| `get_transaction` | What was this transaction? |
| `list_bank_ledger_transfers` / `get_bank_ledger_transfer` | What moved between accounts? |
| `list_manual_journal_entries` / `get_manual_journal_entry` | What adjustments were posted by hand? |
| `list_deposit_slips` | Which payments were banked together? |

**Financial reports**

| Tool | Answers questions like |
|---|---|
| `get_balance_sheet` | What are we worth, as at a date? |
| `get_income_statement` | How did we do over a period? |
| `get_cash_flow_statement` | What moved in and out, by month or property? |
| `get_general_ledger` | Every posting to an account — narrow it, it gets large. |
| `get_rent_payments_report` | What rent came in, and how was it paid? |
| `get_owner_statement` | What does this owner get? |
| `get_accounting_summary` | Headline figures — on-time rent, online payments, daily money movement, returns and disputes. |

**Maintenance** *(served by MagicDoor's maintenance service)*

| Tool | Answers questions like |
|---|---|
| `list_maintenance_requests` / `get_maintenance_request` | What's broken? What came in this week? |
| `get_maintenance_request_history` | What happened with this, and how long did it sit? |
| `get_maintenance_request_stats` | How much is outstanding? |
| `list_work_orders` / `get_work_order` | What work is open? What is this vendor doing? |
| `get_work_order_history` | Why is this taking so long? |
| `list_work_order_schedule` | What's happening on Tuesday? |
| `list_recurring_work_orders` / `get_recurring_work_order` / `..._stats` | What repeats, how often, and what does it cost? |
| `list_vendors` / `get_vendor` / `get_vendor_overview` | Who do we use for plumbing? How much do we spend with them? |
| `list_vendor_categories` / `list_maintenance_request_categories` | How is work classified? |
| `list_run_books` / `get_run_book` | What's our process for this kind of problem? |

**Conversations**

| Tool | Answers questions like |
|---|---|
| `list_chats` | What are people asking about? Which chats are still open? |
| `get_chat` | Who's in this conversation, and what's it about? |
| `get_chat_messages` | What was actually said? |
| `list_unread_messages` | What needs a response? |
| `search_chat_messages` | Did anyone mention the boiler? |

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

## Development

```bash
npm install
npm run build
MAGICDOOR_API_KEY=magic_… MAGICDOOR_ENV=development node dist/index.js
```

The server speaks MCP over stdio, so it expects a client on the other end rather than a terminal.
`npx @modelcontextprotocol/inspector node dist/index.js` gives you one to poke at it with.
