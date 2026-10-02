# Project Tracker: release runbook

Adds the **Project Tracker** module (accounts, projects, items, board, timeline, exec summary, metrics, activity,
read-only client links, and a Claude MCP endpoint) next to the existing CRM Config Checklist.

**Nothing in the existing checklist module changes.** The database change is 11 new tables only.

## What ships

| Area | Detail |
|---|---|
| Database | 11 new `Tracker*` tables, 20 indexes, 16 foreign keys, row-level security on all. No existing table is touched. Script: `supabase/migrations/20261002120000_add_project_tracker.sql` |
| Login | Logging in now lands on `/admin/home` (a module picker). `/admin` is still the checklist list. |
| Staff pages | `/admin/tracker/**` (behind the existing admin login) |
| Public pages | `/share/<private link>` and `/api/share/<private link>`: read-only, GET only, no login |
| Claude | `/api/mcp/tracker` (separate from `/api/mcp`), its own key |
| Config change | `next.config.ts` adds stricter headers for the two share paths only |

## Before you start

1. You are on branch `feat/project-tracker`, merged or deployed as a **preview first**.
2. Pick a long random value for `TRACKER_MCP_API_KEY` (at least 24 characters; 40+ is better). Example: `openssl rand -base64 36`.
3. Decide whether to set `TRACKER_TIMEZONE` (an IANA name such as `Asia/Manila`). Without it, "today" is the UTC date, which can differ from your local date for part of the day.

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the **BEFORE** queries below. Write down the four row counts.
3. Paste the whole of `supabase/migrations/20261002120000_add_project_tracker.sql` and click **Run**.
   It runs as one transaction: if anything fails, nothing is applied. It is safe to run twice.
4. Run the **AFTER** queries below.

### BEFORE queries (read-only)

```sql
-- 1. Row counts of the existing tables. Write these down.
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate";

-- 2. The tracker tables must not exist yet. Expect 0 rows.
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Tracker%';
```

### AFTER queries (read-only)

```sql
-- 1. Expect 11 tables.
SELECT count(*) AS tracker_tables FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Tracker%';

-- 2. Row-level security: expect 11 rows, every one true.
SELECT relname, relrowsecurity FROM pg_class
WHERE relkind = 'r' AND relname LIKE 'Tracker%' ORDER BY relname;

-- 3. Expect 16 foreign keys.
SELECT count(*) AS tracker_foreign_keys FROM pg_constraint
WHERE contype = 'f' AND conrelid::regclass::text LIKE '"Tracker%';

-- 4. The existing counts must match what you wrote down.
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate";
```

This script was rehearsed on a copy of the current schema before release: it ran twice with no errors, left the
existing tables byte-for-byte identical, produced a database with no difference from `prisma/schema.prisma`, and
a deliberately broken copy applied nothing.

## Step 2: set environment variables in Vercel

Project settings, **Environment Variables**, for the environments you will use (start with Preview):

| Name | Value | Required |
|---|---|---|
| `TRACKER_MCP_API_KEY` | a long random value (24+ characters) | Yes, for the Claude connection |
| `TRACKER_TIMEZONE` | for example `Asia/Manila` | Optional |

No other new variables. Share links need none. Do **not** reuse `MCP_API_KEY` (keeping them separate lets you
rotate either one without affecting the other).

## Step 3: deploy a preview, then production

1. Deploy the branch as a **preview** first. Run the verification list below against the preview URL.
2. When happy, promote or merge to production the way you normally do.
3. Add an entry date to `CHANGELOG.json` (`deployed_at` is `null` until you do).

## Verification (what to click, what success looks like)

1. **Login.** Sign in. You land on "Pick a module to start". Open **CRM Config Checklist**: your clients and checklists look exactly as before.
2. **Tracker.** Open **Project Tracker**. Create an account, add a contact, create a project, add two items.
   Success: the project appears in the Portfolio with a health badge.
3. **Views.** On the project, open **Summary**, **Board** (drag a card), **Timeline**, **Metrics**, **Activity**.
4. **Client link.** Click **Share**, create a link, copy it, open it in a private browser window.
   Success: a read-only summary with no team-only items and no blocker reasons. Then click **Revoke** and reload the private window:
   it shows "This link is not available".
5. **Claude.** Connect the MCP (below) and ask: "Where are we on <project>?" Then ask it to mark an item done.
   Success: it answers from the project, and the website's **Activity** tab shows the change "via Claude".
6. **Problem signs:** being sent back to login unexpectedly, a red error banner, a blank project page, or
   a client link that shows internal information (stop and revoke all links if this ever happens).

## Connect Claude

The endpoint is `https://<your-app-domain>/api/mcp/tracker`. For Claude Code:

```bash
claude mcp add --transport http tracker https://<your-app-domain>/api/mcp/tracker --header "Authorization: Bearer <TRACKER_MCP_API_KEY>"
```

For a claude.ai custom connector use the URL with `?api_key=<TRACKER_MCP_API_KEY>` appended.
See `.claude/skills/project-tracker-mcp/SKILL.md` for the tools and how to talk to them.

## Rollback

- **Code:** redeploy the previous deployment in Vercel. The checklist module is unaffected either way.
- **Database (destructive: deletes all tracker data, existing tables untouched).** Only if you must undo the tables:

```sql
BEGIN;
DROP TABLE IF EXISTS "TrackerShareLink" CASCADE;
DROP TABLE IF EXISTS "TrackerActivity" CASCADE;
DROP TABLE IF EXISTS "TrackerMetricReading" CASCADE;
DROP TABLE IF EXISTS "TrackerMetric" CASCADE;
DROP TABLE IF EXISTS "TrackerRemark" CASCADE;
DROP TABLE IF EXISTS "TrackerItemDependency" CASCADE;
DROP TABLE IF EXISTS "TrackerItem" CASCADE;
DROP TABLE IF EXISTS "TrackerPhase" CASCADE;
DROP TABLE IF EXISTS "TrackerProject" CASCADE;
DROP TABLE IF EXISTS "TrackerPerson" CASCADE;
DROP TABLE IF EXISTS "TrackerAccount" CASCADE;
COMMIT;
```

- **Emergency stop for client links:** in the app, open each project's **Share** dialog and revoke, or run
  `UPDATE "TrackerShareLink" SET "revokedAt" = now() WHERE "revokedAt" IS NULL;`
- **Emergency stop for Claude:** remove or change `TRACKER_MCP_API_KEY` in Vercel and redeploy.

## Known limits

- Client-link rate limiting is per running server instance (best effort). The link itself (256 random bits, stored only as a hash) is the real protection.
- Local development must **not** use the live database: `.env.local` points at it. Use `.env.development.local` with a local Postgres (see README).
- The existing `prisma/migrations` history cannot be replayed on an empty database (two migrations share a timestamp and both add `AdminUser.googleId`). This release does not touch it; apply database changes with the SQL in `supabase/migrations/`.
- Client contributor links (clients updating their own items) are not part of this release.
