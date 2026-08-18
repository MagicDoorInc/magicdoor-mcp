# Ask your portfolio anything

MagicDoor now connects to the AI assistant you already use. Ask a question in plain English and
get an answer drawn from your own live data — no exports, no dashboards, no clicking through six
screens to find one number.

*"Which leases are carrying a balance over $500?"*

*"What's the story with the leak at 14 Oak Street — when was it reported and what's happened since?"*

*"How much have we spent with Riverside Plumbing this year?"*

*"Show me everything expiring in the next 60 days, with the current rent and what the renewal offer was."*

Your assistant reads the answer straight out of MagicDoor — the same properties, leases, ledgers,
work orders and conversations your team works in every day.

---

## What it can see

**Your portfolio** — properties, units, tenants and owners.

**Leases** — terms, rent, tenants and balances. The full transaction ledger with every charge,
payment, credit, late fee and transfer. Security deposits. What's billed each period versus what
has actually posted. Renewals, renewal offers, move-outs, subsidies, documents.

**The books** — bank accounts, chart of accounts, transactions, transfers and journal entries.
Balance sheet, income statement, cash flow, general ledger, rent payments and owner statements —
on a cash or accrual basis, for the company or per property.

**Maintenance** — what tenants reported, the work raised from it, who's doing it and what it
costs. Schedules, recurring work, vendors and their spend, and your run books.

**Conversations** — chats with tenants, owners and vendors, what's unread, and search across
every message.

---

## Built to be safe to hand to an AI

**It can only read.** There is no way to create, change or delete anything in MagicDoor through
this connection. Not a setting, not a policy — there is simply no such capability in the software.

**You choose what it can see.** An API key is scoped to a subset of your own permissions when you
create it. Give an assistant read access to leases and maintenance and nothing else, and that is
all it will ever see.

**It can never exceed you.** Permissions are re-checked every time the key is used, against what
you can do at that moment. Narrow your own access and every key you created narrows with it,
immediately, with nothing to remember to update.

**Revoke it in one click.** Keys stop working the instant you revoke them. There is no session to
expire and no cached access to wait out.

**It runs on your machine.** The connector runs locally, alongside your assistant. Your key is
never sent anywhere except MagicDoor itself.

---

## Setting it up

### 1. Create an API key

In MagicDoor, go to **Settings → API keys** and create one. Choose the permissions the assistant
should have — read access to properties, units, leases, tenants and owners covers most questions.

**Copy the key when it's shown.** It appears exactly once and cannot be retrieved afterwards. If
you lose it, revoke it and make another.

### 2. Add it to your assistant

You'll need [Node.js](https://nodejs.org) 20 or newer, which most machines already have.

#### Claude Code

```bash
claude mcp add magicdoor -e MAGICDOOR_API_KEY=magic_your_key_here -- npx -y @magicdoor/mcp
```

#### Claude Desktop

Edit `claude_desktop_config.json` — on macOS at
`~/Library/Application Support/Claude/`, on Windows at `%APPDATA%\Claude\` — and add:

```json
{
  "mcpServers": {
    "magicdoor": {
      "command": "npx",
      "args": ["-y", "@magicdoor/mcp"],
      "env": { "MAGICDOOR_API_KEY": "magic_your_key_here" }
    }
  }
}
```

Restart Claude Desktop.

#### Cursor

Create `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` to use it everywhere:

```json
{
  "mcpServers": {
    "magicdoor": {
      "command": "npx",
      "args": ["-y", "@magicdoor/mcp"],
      "env": { "MAGICDOOR_API_KEY": "magic_your_key_here" }
    }
  }
}
```

#### VS Code with GitHub Copilot

Create `.vscode/mcp.json`. Note that VS Code uses `servers` rather than `mcpServers`:

```json
{
  "servers": {
    "magicdoor": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@magicdoor/mcp"],
      "env": { "MAGICDOOR_API_KEY": "magic_your_key_here" }
    }
  }
}
```

#### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json` and add the same `mcpServers` block shown for Cursor.

#### Anything else that speaks MCP

The connector is a standard MCP server over stdio. Point any MCP-capable client at
`npx -y @magicdoor/mcp` with `MAGICDOOR_API_KEY` in its environment.

### 3. Ask it something

Restart your assistant and try:

> How many units do we manage, and which leases are currently carrying a balance?

---

## Questions

**Does it work with ChatGPT?**
Not yet. ChatGPT connects to MCP servers hosted on the web, and this one runs on your own
machine. Assistants that run locally — Claude Code, Claude Desktop, Cursor, VS Code, Windsurf —
are supported today.

**Can it change anything by mistake?**
No. Every capability it has is a read. There is no write path in the software for an assistant to
find, misuse, or be talked into.

**What does it cost?**
Nothing. It's included with MagicDoor.

**Where does my data go?**
To your assistant, and nowhere else. The connector runs on your machine and talks directly to
MagicDoor. Note that your assistant's provider will see the data it retrieves, the same as
anything else you paste into a conversation — so treat it with the care your own privacy policy
requires.

**Can I give one to my bookkeeper?**
Yes, and this is a good use of it. Create a key scoped to just the accounting permissions. It
will never be able to see maintenance or conversations, and you can revoke it when the engagement
ends.

**Which environment does it read?**
Production by default. Set `MAGICDOOR_ENV` to `staging`, `demo` or `development` to point
elsewhere.

---

## Under the hood

Open source, at [github.com/MagicDoorInc/magicdoor-mcp](https://github.com/MagicDoorInc/magicdoor-mcp).
Read the code, see exactly what it does, or open an issue.

Published as [`@magicdoor/mcp`](https://www.npmjs.com/package/@magicdoor/mcp) on npm.
