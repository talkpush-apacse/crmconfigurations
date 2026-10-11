# Archive a CRM config checklist: release runbook

Adds **Archive checklist** (and **Restore checklist**) so finished checklists leave your working lists without being deleted.

**Nothing existing is removed or renamed.** Delete is unchanged. Client, editor and view links all keep working for an archived checklist.

## What ships

| Area | Detail |
|---|---|
| Database | **1 new optional column**, `Checklist.archivedAt`. Empty for every existing checklist (= active). No row is changed. Script: `supabase/migrations/20261011120000_add_checklist_archived_at.sql` |
| Checklist page | **Archive checklist** in the ... menu (asks first). Once archived: an "Archived" tag by the name, a banner with **Restore checklist**, and the menu item becomes **Restore checklist** |
| Account page | A checklist's ... menu has **Archive checklist**. Archived ones sit under **Show archived checklists (n)**, each with a **Restore** button |
| Checklist list (`/admin`) | Archived checklists are hidden. Tick **Show archived** to see them (tagged "Archived"); the row menu has Archive / Restore |
| Account cards | The checklist count on an account card counts active checklists only. "Needs an account" leaves archived ones out |
| Reminder emails | An archived checklist gets no owner-notification emails, and is left out of the weekday activity digest |
| Claude (MCP) | `list_checklists` and `search` leave archived checklists out. `list_checklists` takes `include_archived: true` to show them. Opening one by its slug still works |
| Privacy | `archivedAt` is never sent to client, editor or view links |
| Permissions | Only a Talkpush Admin (editor login) can archive or restore. A read-only login gets the same "your login is read-only" message as for any change |
| Environment | No new variables |

## What archiving does not do (say this to anyone who asks)

- It does **not** delete anything and does **not** switch off any link: the client can still open and edit their checklist.
- It does **not** change the checklist's content, version or "last updated" time, so it can never cause a save conflict for someone editing.
- It does **not** stop the checklist being exported or opened by staff who have the address.

## Before you start

Merge only **after** the SQL below has been applied to Supabase. The checklist list reads the new column, so if it is missing, **the checklist list and company pages would fail to load** until it exists. (Adding the column first is harmless: the current live code ignores it.)

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the BEFORE query and write down the number:
   ```sql
   SELECT count(*) AS checklists FROM "Checklist";
   SELECT column_name FROM information_schema.columns WHERE table_name = 'Checklist' AND column_name = 'archivedAt';  -- expect no rows
   ```
3. Paste the whole of `supabase/migrations/20261011120000_add_checklist_archived_at.sql` and click **Run**. It runs as one transaction and is safe to run twice.
4. Run the AFTER queries:
   ```sql
   SELECT count(*) AS checklists FROM "Checklist";                                          -- same number as before
   SELECT count(*) AS archived FROM "Checklist" WHERE "archivedAt" IS NOT NULL;             -- expect 0
   SELECT column_name FROM information_schema.columns WHERE table_name = 'Checklist' AND column_name = 'archivedAt';  -- expect 1 row
   ```

## Step 2: merge and check

1. Merge the pull request. Vercel deploys it.
2. Open a checklist, click the **...** menu, then **Archive checklist**, then confirm. You should see an "Archived" tag by the name and a grey banner with **Restore checklist**.
3. Open the account it belongs to: the checklist is gone from **Config checklists** and appears under **Show archived checklists (1)**.
4. Open the checklist's client link in a private window: it still opens normally.
5. Click **Restore** (account page) or **Restore checklist** (banner): it is back in the list.

## Rollback

Code: revert the pull request. Database (only if you want the column gone; archived checklists simply become active again):

```sql
BEGIN;
ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "archivedAt";
COMMIT;
```
