---
name: ai-voice-call-checklist-import
description: Converts a client's "AI Voice Call Checklist" Excel scoping document (Talkpush's recurring template for designing AI voice call agents — Global Agent Settings, Pre-Screening Questions, Agent 1-4 scripts, Call Handling, FAQ Content, a client sign-off tab) into a real checklist with custom tabs in this app, and can create/populate that checklist end-to-end including in production. Use this whenever the user shares or references an Excel file for a new AI voice call client, asks to "set up [client]'s AI voice call checklist," "convert this Excel into a checklist," "build the custom tabs for [client]," or asks to create/deploy a client's voice call checklist in production — even if they don't name this skill directly. Do not use this for arbitrary spreadsheets unrelated to the AI Voice Call template, or for editing the standard (non-custom) CRM checklist tabs that already exist for every client.
---

# AI Voice Call Checklist Import

## Why this exists

Talkpush SEs scope each client's AI voice call design in a shared Excel template before it becomes
a real checklist the client reviews and approves in this app. That conversion was done once by hand
for Inspiro (the first client) — reading the file, discovering what this app's custom-tab system
could and couldn't represent, extending the platform where it couldn't, and populating the real
content into production. This skill captures that so the next client doesn't repeat the discovery —
only the (much smaller) job of reading their specific file and calling the tools that already exist.

**Read `references/tab-mapping.md` before writing anything** — it has the exact, validated mapping
from each sheet in the source workbook to what gets created here, including the judgment calls
(how to infer a question's type, how to fold an internal note into a script, what to do with an
approval checkbox) that took real back-and-forth to settle the first time.

## Ground rules

These aren't stylistic preferences — every one of them is here because getting it wrong would mean
a client either signs off on something Talkpush never actually proposed, or loses something they
did submit.

- **Never invent data.** Every value must trace to a specific cell in the source workbook. If
  something is genuinely missing or ambiguous, leave it blank and say so — don't fill in a
  plausible-sounding value, even a very standard one (e.g. don't invent a list of education levels
  for a "highest educational attainment" question just because it's a common field elsewhere).
- **Never drop a row.** Every row in every source table must appear in the destination. Whoever
  filled out the source spreadsheet did that work; losing a row silently is worse than any
  formatting mistake.
- **Ask before guessing.** If the sheet structure or a cell's intent is genuinely unclear, stop and
  ask the user rather than picking an interpretation — a wrong guess here means the client either
  sees wrong data or has to redo their review.
- **Don't force a bad fit.** If this app's custom tabs can't cleanly represent something the source
  does, say what the gap is and what the options are (including "extend the platform," which is
  exactly how the typed-table-column and document-style-tab features described in
  `references/mcp-tools.md` came to exist) — don't silently downgrade to something worse than the
  source.
- **Self-audit before calling it done.** Read every tab back after writing it and check row/field
  counts and Approved? values against the source, cell by cell. A write that returned success is not
  the same as a write that's correct — report a confidence level per tab, and say exactly what you
  checked.
- **Flag inconsistencies in the source itself; don't fix them.** If one tab's setting contradicts
  another (this happened for Inspiro — one tab said the call window was 9am-6pm, two other tabs said
  10am-5pm), that's the client's discrepancy to resolve, not something to silently reconcile.
- **A completed checklist is a draft for the requesting SE to review.** Never imply it's ready to
  send to the actual client — that's always the user's explicit call, separate from "the import
  finished successfully."

## Workflow

1. **Get the file and the client name.** If either is missing, ask — don't guess a client name from
   a filename that might be a version string or someone else's shorthand.

2. **Parse the workbook programmatically.** Use Python + openpyxl (or an equivalent), and detect
   structure by header labels, section titles, and indentation — never by hardcoded row numbers.
   The exact row layout drifts between file versions and between clients even though the sheet names
   and section headers stay the same. `references/tab-mapping.md` documents every header/label to
   look for per sheet, plus the one worked, real extraction script (`references/worked-example.md`)
   that already handles this correctly for the Inspiro file — adapt it rather than starting from
   scratch, but verify its assumptions (section boundaries, header rows) still hold for the new file
   before trusting it blindly.

3. **Present the proposed mapping before writing anything.** Show the user, per sheet: what it will
   become (which standard tab, or which new custom tab and shape), and every ambiguity you had to
   flag per the ground rules above (an inferred question type with no source options, a stray
   comment with no header to live under, an inconsistency between sheets, anything the mapping in
   `references/tab-mapping.md` doesn't cleanly cover for this file). Get the user's go-ahead before
   step 5.

4. **Confirm the target environment explicitly.** `.env.local` in this repo points
   `DATABASE_URL_DIRECT` at the live production database, and `npm run dev` or any ambient script
   picks that up automatically — so ask the user whether this run should write to production or to
   a local scratch database (`npx prisma dev --name default`) first, and always pass the URL for
   that command explicitly rather than relying on which `.env*` file happens to be loaded. Never
   assume production because "that's the point eventually" — confirm it for this specific run.

5. **Create the checklist if it doesn't already exist.** Check first — a client checklist may
   already exist under a name/slug close to what you'd generate, and colliding with or overwriting
   real data for an existing client is the single worst outcome here. There's no MCP tool that
   creates a new checklist yet, so use `scripts/create-checklist.ts` (bundled with this skill,
   already mirrors `POST /api/checklists` exactly — see its own comments) rather than writing this
   by hand each time.

6. **Populate it via the MCP tools**, in this order: prescreening questions first, then each custom
   tab. `references/mcp-tools.md` has the exact tool schemas and the connection pattern that's
   actually proven to work (an in-process MCP client via `InMemoryTransport`, no network call, no
   credential ever touches a shell command) — follow it rather than trying to hit the HTTP endpoint
   with a bearer token, which real Claude Code sessions have been auto-blocked from doing.

7. **Self-audit.** Read every tab back (directly via Prisma, or via `list_custom_tabs` /
   `get_checklist`) and verify counts and values against what you parsed from the source in step 2.
   Report a confidence level per tab — "High" means you actually re-checked it, not that the write
   didn't error.

8. **Report back.** What was created, a link to review it, the self-audit results per tab, every
   source inconsistency found (not fixed), and an explicit reminder that this is a draft for the
   user's review — not yet something to send the actual client.

## Reference files

- `references/tab-mapping.md` — the exact sheet-by-sheet mapping, what each becomes, and the
  judgment calls already settled (question-type inference, how to fold inline notes into a script,
  etc.). Read this before parsing anything.
- `references/mcp-tools.md` — this app's actual custom-tab data model and the MCP tool schemas
  (`add_custom_tab`, `update_custom_tab`, `add_prescreening_questions`, `list_custom_tabs`,
  `preview_custom_tab`), plus the connection pattern for calling them from a script.
- `references/worked-example.md` — the real extraction and population scripts used for Inspiro, kept
  as a concrete pattern to adapt rather than a template to fill in blindly.
- `scripts/create-checklist.ts` — run this to create a new checklist; mirrors the app's own creation
  endpoint so you don't have to re-derive its shape each time.
