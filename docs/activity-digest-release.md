# Daily activity digest: send record (release runbook)

Adds a **send record** for the weekday 8:00 am Manila digest, so a missed day is caught up and a duplicate run cannot send twice.

**Nothing existing is removed or renamed.** The database change is **1 new table only**, with no personal data and no change content in it.

## What ships

| Area | Detail |
|---|---|
| Database | 1 new table, `ActivityDigestRun`: 2 indexes (the primary key and a unique `windowEnd`), row-level security on. No existing table, column or row is touched. Script: `supabase/migrations/20261011150000_add_activity_digest_run.sql` |
| Digest | Records each 8:00 am slot (sending, sent, skipped, failed). A second run for the same slot stops. The next digest starts where the last sent or skipped one ended (up to 7 days back), so a missed day is caught up |
| Environment | No new variables |

## What is and is not kept

- **Kept:** the window start and end, a status word, how many changes were listed, a short plain reason (for example "no changes"), and when the run started and finished.
- **Never kept:** email addresses, names, or any text from a checklist, workflow or tracker.
- Expected volume: about 260 rows a year. Nothing is deleted automatically.

## Before you start

1. Apply the SQL below **before** merging. (The digest still works if the table is missing: it logs a warning and sends without the duplicate and catch-up protection. But the protection only exists once the table does.)

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the **BEFORE** queries and write down the result:

   ```sql
   SELECT to_regclass('"ActivityDigestRun"') IS NOT NULL AS table_exists;   -- expect: false
   SELECT (SELECT count(*) FROM "Checklist") AS checklists,
          (SELECT count(*) FROM "WorkflowProject") AS workflows,
          (SELECT count(*) FROM "TrackerProject") AS tracker_projects;       -- write these three numbers down
   ```

3. Paste the whole of `supabase/migrations/20261011150000_add_activity_digest_run.sql` and click **Run**. It is one transaction: it either all applies or nothing does. Running it twice is harmless.
4. Run the **AFTER** queries:

   ```sql
   SELECT to_regclass('"ActivityDigestRun"') IS NOT NULL AS table_exists;   -- expect: true
   SELECT relrowsecurity AS rls_on FROM pg_class WHERE relname = 'ActivityDigestRun';   -- expect: true
   SELECT count(*) AS rows FROM "ActivityDigestRun";                        -- expect: 0
   SELECT (SELECT count(*) FROM "Checklist") AS checklists,
          (SELECT count(*) FROM "WorkflowProject") AS workflows,
          (SELECT count(*) FROM "TrackerProject") AS tracker_projects;       -- expect: the same three numbers as before
   ```

## Step 2: merge and check

1. Merge the pull request and wait for the Production deployment to finish.
2. After the next weekday 8:00 am digest (or a manual run with the secret), check the record:

   ```sql
   SELECT "windowStart", "windowEnd", status, "changeCount", reason, "startedAt", "finishedAt"
   FROM "ActivityDigestRun" ORDER BY "windowEnd" DESC LIMIT 5;
   ```

   Success: one row per weekday with status `sent` (or `skipped` with reason `no changes` on a quiet day).
   Problem: a row stuck on `sending` for more than 30 minutes, or `failed`. The next run takes over a stuck or failed slot by itself.

## Rollback

Only the send records are lost; nothing else is touched, and the digest keeps working without the table.

```sql
BEGIN;
DROP TABLE IF EXISTS "ActivityDigestRun";
COMMIT;
```
