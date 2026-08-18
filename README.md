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
| `get_lease_charge` / `get_lease_payment` / `get_lease_credit` / `get_lease_late_fee` / `get_lease_transfer` / `get_lease_deposit` | Drill into one entry from a ledger. |
| `list_lease_recurring_charges` / `..._credits` / `..._payments` | What is billed each period, as opposed to what has posted? |
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

**Every tool is read-only.** There is no way to create, change or delete anything in MagicDoor
through this server, by design.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MAGICDOOR_API_KEY` | yes | — | The key you created in MagicDoor. |
| `MAGICDOOR_ENV` | no | `production` | `production`, `staging`, `demo` or `development`. |
| `MAGICDOOR_AUTH_URL` | no | from `MAGICDOOR_ENV` | Override the auth host, for local development. |
| `MAGICDOOR_API_URL` | no | from `MAGICDOOR_ENV` | Override the API host, for local development. |

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
