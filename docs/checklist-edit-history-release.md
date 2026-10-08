# Named edit links and edit history: release runbook

Lets staff give each person their own editor link ("Jane Cruz (TP)") and see **who changed what** on a checklist:
the person, the time, the tab, row and column, and the text before and after.

**Nothing existing is removed or renamed.** The original editor link, the client form link and every saved checklist
behave as before. The database change is **2 new tables only**.

## What ships

| Area | Detail |
|---|---|
| Database | 2 new tables, `ChecklistEditLink` and `ChecklistEditEvent`: 7 indexes (2 are the primary keys), 3 foreign keys, row-level security on both. No existing table, column or row is touched. Script: `supabase/migrations/20261008120000_add_checklist_edit_history.sql` |
| Staff screens | Checklist card menu: **Named edit links** (create, copy, rename, new address, turn off) and **Edit history**. New page `/admin/checklists/<id>/history`, also in the checklist header menu |
| Editor | A named link shows "Editing as <name>" in the header. A turned-off link shows "This link has been turned off" |
| Recording | Edits through a named link, the original editor link, the client form link (`/client/...`), staff saves, Claude's changes to custom tabs, and snapshot restores |
| Privacy | `/editor/*`, `/api/checklists/by-token/*` and `/api/export/by-token/*` now send `no-referrer` and `no-store` (the secret is in the address) |
| Environment | No new variables |

## What is and is not recorded (say this to anyone who asks)

- **History starts when this ships.** Nothing before is recorded. The page says "Changes before <date> were not recorded".
- **Recorded as a name:** a named link. **Recorded as unnamed:** "Original shared link (unnamed)" and "Client form link (unnamed)". A name shows which link was used, not for certain who was typing (links can be forwarded).
- **Not recorded in this release:** Claude's other tools (the integrations tool, the configurator), applying a template, and the messaging-template edit on the client form link. The page says so, and flags a section whose latest change has no record.
- **Never recorded:** passwords, keys, secrets and webhooks (the fact of the change is kept, the value is not), admin settings and integrations (recorded as "changed", no values), and file addresses (only the file name).
- **Saves are never held up or failed by the history.** It is written after the save, in the background. If that write fails it is logged and dropped, so very rarely a change may be missing.
- Typing in one cell within 10 minutes is one line (first "before", latest "after"). A paste or CSV import of more than 25 cells in one section becomes one "replaced" line.
- The older "send the whole document" save method is recorded as one coarse line, not itemised.
- Retention: nothing is deleted automatically yet. Expected volume is small (tens of MB per year across about 100 checklists). Decide on a prune later.

## Before you start

1. Merge only after the SQL below has been applied to Supabase. (The code still saves correctly if the tables are missing, but the Edit links and Edit history screens would show errors and nothing would be recorded.)
2. The editor link text for named links is stored readable (like the original link) so you can copy it again. Anyone with read access to the database can see them.

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the **BEFORE** queries. Write down the counts.
3. Paste the whole of `supabase/migrations/20261008120000_add_checklist_edit_history.sql` and click **Run**.
   It runs as one transaction: if anything fails, nothing is applied. It is safe to run twice.
4. Run the **AFTER** queries.

### BEFORE queries (read-only)

```sql
-- 1. Row counts of the existing tables. Write these down.
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate";

-- 2. The new tables must not exist yet. Expect 0 rows.
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ChecklistEdit%';
```

### AFTER queries (read-only)

```sql
-- 1. Expect 2 tables.
SELECT count(*) AS edit_tables FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ChecklistEdit%';

-- 2. Row-level security: expect 2 rows, both true.
SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relname LIKE 'ChecklistEdit%' ORDER BY relname;

-- 3. Expect 7 indexes and 3 foreign keys.
SELECT count(*) AS edit_indexes FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'ChecklistEdit%';
SELECT count(*) AS edit_foreign_keys FROM pg_constraint
WHERE contype = 'f' AND conrelid::regclass::text LIKE '"ChecklistEdit%';

-- 4. The existing counts must match what you wrote down. Both new tables start empty.
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate"
UNION ALL SELECT 'ChecklistEditLink', count(*) FROM "ChecklistEditLink"
UNION ALL SELECT 'ChecklistEditEvent', count(*) FROM "ChecklistEditEvent";
```

The script was rehearsed on a local copy of the current schema: it ran twice with no errors, the resulting database
had no difference from `prisma/schema.prisma`, and both tables have row-level security on. Tests that exercise the
routes and database ran only against a local throwaway database, never against Supabase.

## Step 2: deploy a preview, then production

1. Deploy the branch as a **preview** first and run the verification list against the preview URL.
2. When happy, merge to production the way you normally do.
3. Record the deploy date in `CHANGELOG.json` (`deployed_at` is `null` until you do).

## Verification (what to click, what success looks like)

1. **Create a link.** Dashboard, a checklist's `...` menu, **Named edit links**. Type a name, click **Create link**.
   Success: the link appears with "Has not opened it yet" and "Link for <name> copied".
2. **Edit as that person.** Paste the link into a private browser window. Success: "Editing as <name>" is in the header.
   Change a cell in the User List and click away; "All changes saved" appears.
3. **See the change.** Back on the dashboard, `...` menu, **Edit history**. Success: one line, "<name> (named link) changed User List, <row>, <column>". Click the arrow: before and after, with what changed highlighted.
4. **Filter.** Pick the person in **Person** and a **Tab**. Success: only matching lines.
5. **Typing is one line.** Change the same cell three times quickly. Success: still one line, with the first "before" and the last "after".
6. **Turn it off.** In **Named edit links** click **Turn off**, confirm. Reload the private window.
   Success: "This link has been turned off". The history keeps the person's name.
7. **The old link.** Open the original editor link (**Copy editor link**). Success: it still works, with no "Editing as" label. Change a cell: the history shows "Original shared link (unnamed)".
8. **Read-only logins.** Sign in as a read-only user. Success: **Edit history** opens; **Named edit links** is not offered.
9. **Problem signs:** a save that fails with a history error, a name missing from a recorded change, a password visible anywhere in the history, or a turned-off link that still opens the checklist (including Export XLS).

## Rollback

- **Code:** redeploy the previous deployment in Vercel. Named links stop working at once (they are not known to the old code); the original editor link keeps working.
- **Database (destructive: deletes all named links and history, checklists untouched).** Only if you must undo the tables:

```sql
BEGIN;
DROP TABLE IF EXISTS "ChecklistEditEvent" CASCADE;
DROP TABLE IF EXISTS "ChecklistEditLink" CASCADE;
COMMIT;
```

## Banner: who else is editing this tab (version 3.6, no database change)

A banner on each checklist tab (editor link, client form link, staff pages) when someone else has saved a change to that tab.

- **Amber, with Reload:** someone saved this tab after you opened the page, so your next save of it would be refused. Reload first.
- **Quiet note:** someone changed this tab in the last 10 minutes. If you both edit it, whoever saves second has to reload.
- **Names:** from the edit history. Clients see staff and Claude as "Talkpush team" (never an email address); staff see full names. People on the original shared link or the client form link are described ("Someone using the shared link"), not named.
- **What it cannot do:** it only knows about SAVED changes (autosave runs half a second after typing stops), so it cannot show who merely has the tab open. All custom tabs are saved together, so a change to any custom tab warns people on every custom tab.
- **Cost:** one small read every 15 seconds per open page, and only while the page is on screen. Never part of saving.
- **Verify:** open a tab in two places (for example your staff view and a named link). Change a cell in one and click away. Within about 15 seconds the other shows the amber banner. Reload clears it and leaves the quiet note.

## Follow-ups to decide later

1. Keep or close the public client form link (`/client/<slug>`) as a way to save changes.
2. Keep or retire the original editor link once everyone has a named link.
3. Record Claude's remaining tools and who asked Claude (needs the connector to pass the person's identity).
4. Per-tab "last edited by", the person's name in the owner notification email, restoring a value from the history, a retention prune.
