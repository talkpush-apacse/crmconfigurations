# Archive a workflow: release runbook

Adds **Archive workflow** (and **Restore workflow**) so finished workflows leave your working lists without being deleted. It works like archiving a checklist.

**Nothing existing is removed or renamed.** Delete is unchanged. Share links, review links and the client page keep working for an archived workflow.

## What ships

| Area | Detail |
|---|---|
| Database | **1 new optional column**, `WorkflowProject.archivedAt`. Empty for every existing workflow (= active). No row is changed. Separate from the review `status` (draft, shared, approved ...). Script: `supabase/migrations/20261011150000_add_workflow_archived_at.sql` |
| Workflows list | Archived workflows are hidden. Tick **Show archived** to see them (tagged "Archived"). The card menu has **Archive workflow** / **Restore workflow** |
| Workflow editor | A new **...** button at the end of the top bar with **Archive workflow** (asks first). Once archived: a grey banner with **Restore workflow** |
| Account page | A workflow's ... menu has **Archive workflow**. Archived ones sit under **Show archived workflows (n)**, each with a **Restore** button |
| Account cards | The workflow count counts active workflows only. "Needs an account" and the "Needs your attention" box leave archived ones out |
| Email | A client comment on an archived workflow **still emails the super admin** (a real client action). The weekday activity digest leaves archived workflows out |
| Claude (MCP) | `list_workflows` leaves archived workflows out; it takes `include_archived: true` to show them. Opening one by its id still works. The Configuration Plan's workflow picker leaves them out too |
| Privacy | `archivedAt` is never sent on a share or client link (the client copy is built from an allow-list) |
| Permissions | Only a Talkpush Admin (editor login) can archive or restore. A read-only login gets the usual "your login is read-only" message |
| Environment | No new variables |

## What archiving does not do (say this to anyone who asks)

- It does **not** delete anything and does **not** switch off any link. Reviewers can still open the shared map, comment and approve.
- It does **not** change the workflow's content, revision, status or "last updated" time, so it can never cause a save clash for someone editing.
- It does **not** hide the workflow from anyone who has its address or from staff who open it directly.

## Before you start

Merge only **after** the SQL below has been applied to Supabase. The workflow list reads the new column, so if it is missing, **the Workflows list and account pages would fail to load** until it exists. (Adding the column first is harmless: the current live code ignores it.)

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the BEFORE query and write down the number:
   ```sql
   SELECT count(*) AS workflows FROM "WorkflowProject";
   SELECT column_name FROM information_schema.columns WHERE table_name = 'WorkflowProject' AND column_name = 'archivedAt';  -- expect no rows
   ```
3. Paste the whole of `supabase/migrations/20261011150000_add_workflow_archived_at.sql` and click **Run**. It runs as one transaction and is safe to run twice.
4. Run the AFTER queries:
   ```sql
   SELECT count(*) AS workflows FROM "WorkflowProject";                                       -- same number as before
   SELECT count(*) AS archived FROM "WorkflowProject" WHERE "archivedAt" IS NOT NULL;         -- expect 0
   SELECT column_name FROM information_schema.columns WHERE table_name = 'WorkflowProject' AND column_name = 'archivedAt';  -- expect 1 row
   ```

## Step 2: merge and check

1. Merge the pull request. Vercel deploys it.
2. Open a workflow in the editor, click the **...** button at the right of the top bar, then **Archive workflow**, then confirm. You should see a grey banner with **Restore workflow**.
3. Go to **Workflows**: it is gone from the list. Tick **Show archived**: it is back, tagged "Archived".
4. If it has a share link, open that link in a private window: it still opens normally.
5. Click **Restore workflow** (banner or card menu): it is back in the list.

## Rollback

Code: revert the pull request. Database (only if you want the column gone; archived workflows simply become active again):

```sql
BEGIN;
ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "archivedAt";
COMMIT;
```
