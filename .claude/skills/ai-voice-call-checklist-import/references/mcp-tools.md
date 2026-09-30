# This app's custom-tab data model and MCP tools

Source of truth is always the actual code — this file describes it as of the Inspiro import, but the
app evolves. Skim `src/lib/types.ts` (`CustomTab`, `CustomFieldDef`, `CustomTabColumn`), and
`src/lib/mcp-server.ts` / `src/lib/custom-tab-service.ts` for the tools below, before assuming this
doc is still accurate for a new run — especially if it's been a while since the last import.

## The two tab shapes

A custom tab is either:

- **Table-based** (`columns`/`rows`) — one flat grid. Column types: `text, textarea, number, date,
  select, multiselect, email, url, checkbox`.
- **Form-based** (`fields`) — a sequence of fields. Field types: `text, textarea, richtext, number,
  date, select, checkbox, file, table`. A `table`-type field can itself have typed sub-columns via
  `tableColumns` — this reuses the exact same column schema a real table tab's `columns` uses
  (`text, textarea, number, date, select, multiselect, email, url, checkbox`), so all of those are
  valid inside a field's `tableColumns` too, not just the plainer set the outer field types offer.

A tab is one shape or the other, never both — `columns !== undefined` is literally how the app tells
them apart, so never pass both `columns` and `fields` to the same call.

## `add_custom_tab`

```
{
  slug: string,                  // checklist URL slug
  tab_name: string,
  tab_description?: string,      // shown next to the title — always set this, a bare grid with no
                                  // explanation is worse than one extra sentence
  tab_icon?: string,             // Lucide icon name, e.g. "Settings", "Phone", "HelpCircle"
  filled_by?: "client" | "talkpush",   // default "client" — leave unset unless this tab is genuinely
                                        // Talkpush-internal
  place_after?: string,          // sidebar position; default append order is usually fine if you
                                  // create tabs in the order you want them to appear
  // EXACTLY ONE of:
  columns?: [{ key?, label, type, required?, options?, description?, example?, width? }],
  rows?: [{ ...cellValuesByColumnKey }],
  // OR:
  fields?: [{
    id?,           // omit when creating; only meaningful on update_custom_tab (see below)
    label,
    type,          // text|textarea|richtext|number|date|select|checkbox|file|table
    required?,
    placeholder?,
    options?,      // for type "select"
    tableColumns?, // for type "table" — same shape as a table-tab's columns
    initialValue?, // shape depends on type: string for text/textarea/richtext/file, boolean for
                    // checkbox, an array of row objects (keyed by tableColumns' keys) for table
  }],
}
```

Call `preview_custom_tab` first with the same shape to dry-run it (validates + renders without
writing) — worth doing for a tab whose shape you're not fully sure of yet, less necessary once you're
running the same well-known 8-tab pattern from `tab-mapping.md` for the Nth time.

## `update_custom_tab`

Same `columns`/`fields` duality, always a **full replacement** of whichever one you pass (the other
kind stays untouched — you can't switch a tab's shape this way). For `fields`, pass a field's
existing `id` back to preserve its stored value across the update; a field you don't include is
dropped and its stored value is orphaned (reported back to you as a warning), same as a removed
table column.

## `add_prescreening_questions`

Appends to the app's **standard** (non-custom) Pre-Screening Questions tab — this is not a custom
tab tool, it's a different data model (`QuestionRow`). Use this instead of inventing a custom tab for
prescreening content.

`questionType` is a plain string on the wire — the tool accepts anything and won't error on a typo or
an invented type, it'll just silently produce a question the real admin UI's dropdown doesn't
recognize. The tool's own `.describe()` text in `mcp-server.ts` had drifted out of sync with the real
vocabulary once already (it listed a "Booking" type that doesn't exist anywhere else in the app, and
was missing "Audio or Text") — always cross-check `questionType` values against
`DROPDOWN_OPTIONS.questionTypes` in `src/lib/validations.ts`, which is the vocabulary the admin UI
(`PrescreeningSheet.tsx`) actually renders, rather than trusting the tool description alone.

```
{
  slug: string,
  questions: [{
    category: string,              // "Pre-screening" or "Follow-up"
    question: string,
    questionType: string,          // Text|Number|Multiple Choice|Dropdown|Audio|Audio or Text|
                                    // Video|File Upload|Play Media|Geolocation
    answerOptions?: string,        // comma-separated, e.g. "Yes, No"
    approved?: boolean,
    clientComments?: string,       // distinct from `comments`, which is internal SE notes
    // applicableCampaigns/autoReject/rejectCondition/rejectReason/comments also exist —
    // leave them unset unless the source actually specifies them
  }],
}
```

## `list_custom_tabs`

`{ slug, include_rows?: boolean }` — each form-field's current value (keyed by the field's `id`,
under `fields[].value`) and each table-tab's `rowCount` come back regardless of `include_rows`.
`include_rows: true` additionally includes a table-tab's full `rows` array — set it when you need the
actual row data (e.g. to self-audit a table-based tab like FAQ Content cell-by-cell), leave it off
for a quick structural check. Either way this is what you need for finding a field's `id` before
calling `update_custom_tab`.

## Connecting to these tools from a script

There is no MCP tool that creates a brand-new checklist (use `scripts/create-checklist.ts` instead —
see the main SKILL.md). Once a checklist exists, the proven way to call these tools from inside a
Claude Code session in this repo — including against production — is **in-process, not over HTTP**:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../../../src/lib/mcp-server"; // adjust relative path

const server = createMcpServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "your-script-name", version: "0.0.0" });
await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

const res: any = await client.callTool({ name: "add_custom_tab", arguments: { /* ... */ } });
const text = res.content?.[0]?.text ?? "";
if (res.isError) throw new Error(text);
console.log(text);
```

This runs the exact same validation/writing code the deployed app uses, against whichever
`DATABASE_URL_DIRECT` is set for that command — no network call, no bearer token ever appears in a
shell command (a real Claude Code session got auto-blocked from calling the deployed HTTPS `/api/mcp`
endpoint with an embedded `MCP_API_KEY`; this in-process approach is both safer and was the one that
actually worked). Run scripts from inside `crm-config-checklist/` with `npx tsx <path>` so relative
imports and `tsx`'s TypeScript/path handling resolve correctly.

**Environment**: `tsx` does NOT auto-load `.env*` files the way `next dev` does. Pass
`DATABASE_URL_DIRECT` explicitly in the command's own environment every time — for production,
extract it from `.env.local` without printing the raw value:
`DATABASE_URL_DIRECT="$(grep '^DATABASE_URL_DIRECT=' .env.local | cut -d= -f2- | tr -d '"')" npx tsx your-script.ts`.
For a local scratch database instead, start one with `npx prisma dev --name default` and pass its
printed connection string the same way.

**Prisma client**: don't `import { PrismaClient } from "@prisma/client"` — this app generates its
Prisma client to a non-default path. Always get the client the app itself uses,
`import { prisma } from "../../../../src/lib/db"` (adjust the relative path to wherever your script
lives), the same way `createMcpServer()` does internally — anything else fails with a confusing
"Cannot find module" error that has nothing to do with your actual database connection.

See `references/worked-example.md` for the full real script this pattern came from.
