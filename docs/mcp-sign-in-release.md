# Claude sign-in: release runbook

Lets people connect Claude to the CRM tools by adding the connector URL and clicking **Connect**: they sign in with their
usual login and approve on an **Allow** page. No key to copy. Changes made through Claude appear in Activity as
"Claude for <their email>". An admin can see and revoke every connection on the **Connected apps** page.

**The shared keys keep working** (`MCP_API_KEY` for `/api/mcp`, `TRACKER_MCP_API_KEY` for `/api/mcp/tracker`, header or
`?api_key=`). Nobody who is connected today is cut off.

## What ships

| Area | Detail |
|---|---|
| Database | 3 new tables: `McpOAuthClient`, `McpAuthCode`, `McpToken`. Row-level security on all, 4 foreign keys (two point at `AdminUser`, so deleting someone's admin login also removes their Claude connections). No existing table is altered. Script: `supabase/migrations/20261003120000_add_mcp_oauth.sql` |
| Sign-in service | `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/...`, `/api/oauth/register`, `/api/oauth/token`, `/api/oauth/revoke`, `/oauth/authorize`, `/oauth/consent`, `/oauth/decision`, `/oauth/resume` |
| Connectors | `/api/mcp` and `/api/mcp/tracker` accept a signed-in person's token as well as the shared keys. A request with no valid credentials gets a 401 that tells Claude where to sign in. |
| Admin | **Connected apps** page (`/admin/connections`, in the user menu). `/admin/home` resumes an unfinished connect after a first sign-in. |
| Config | `next.config.ts`: no-cache and no-referrer headers for the sign-in paths |

## What an approved person can do

Once someone clicks Allow, the app acts **as that person**, on **both** connectors:
- CRM Config Checklists: read and change, **including permanently removing a message template** (`delete_message_template`).
- Project Tracker: read and change. There is no tracker delete tool.

Only people who already have an admin login can approve. Remove someone's admin login, or revoke them on Connected apps,
and Claude loses access at once.

## Before you start

1. Merge order: this builds on the toolkit (already merged). Deploy a **preview first**.
2. No new environment variables are required. Optional: `MCP_OAUTH_EXTRA_REDIRECTS` (comma separated, exact https addresses) if an
   app other than Claude must be allowed to connect. Claude's own addresses and local apps are already allowed.

## Step 1: apply the database change in Supabase

Run this **before** anyone tries to connect on a deployed build (until then the sign-in pages show an error; the shared keys and
the website are unaffected).

1. Supabase, **SQL Editor**.
2. Run the **BEFORE** queries. Write down the four row counts. The `Mcp%` query must return 0 rows.
3. Paste the whole of `supabase/migrations/20261003120000_add_mcp_oauth.sql` and **Run**. One transaction; safe to run twice.
4. Run the **AFTER** queries.

### BEFORE (read-only)

```sql
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate";

SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Mcp%';
```

### AFTER (read-only)

```sql
-- Expect 3
SELECT count(*) AS mcp_tables FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Mcp%';

-- Expect 3 rows, every one true
SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relname LIKE 'Mcp%' ORDER BY relname;

-- Expect 4
SELECT count(*) AS mcp_foreign_keys FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE '"Mcp%';

-- Must match what you wrote down
SELECT 'AdminUser' AS table_name, count(*) FROM "AdminUser"
UNION ALL SELECT 'Checklist', count(*) FROM "Checklist"
UNION ALL SELECT 'ChecklistSnapshot', count(*) FROM "ChecklistSnapshot"
UNION ALL SELECT 'RequirementsTemplate', count(*) FROM "RequirementsTemplate";
```

This script was rehearsed on a copy of the current schema: it ran twice with no errors, left every existing table structure
identical, and produced a database with no difference from `prisma/schema.prisma`.

## Step 2: deploy a preview and test with a real Claude

Vercel builds the pull request as a preview. Use that preview address (it is public, so Claude can reach it).

1. Open `https://<preview>/.well-known/oauth-authorization-server`. You should see a short block of text (JSON) naming `/oauth/authorize`.
2. In claude.ai: **Settings, Connectors, Add custom connector**. Name it, and use the preview address ending in `/api/mcp/tracker` with **no key**. Click **Connect**.
3. You are sent to your site. Sign in as usual. You land on an **Allow** page that names the app and says what it can do. Click **Allow**.
   Success: you are back in Claude and the connector shows as connected.
4. Ask Claude: "List the tracker projects." Then ask it to mark a test item done.
5. In the website, open the user menu, then **Connected apps**. Your connection is listed. Open that project's **Activity**:
   the change reads "Claude for <your email>".
6. Click **Revoke** on your connection. In Claude, ask again: it should fail. Disconnect and reconnect to confirm a fresh connect works.
7. Confirm an existing shared-key connection (if you have one) still works.

**Problem signs:** the Allow page says the address is not allowed (tell us the address it names, it may need adding), a sign-in loop,
an error page after Allow, or Claude saying it cannot register. Send the exact message without any key.

## Step 3: go live

Merge to `main` the way you normally do, then repeat steps 2.1 to 2.6 on `https://crm.se-talkpush.com`. Then fill in `deployed_at`
for 3.3 in `CHANGELOG.json`.

## Rollback

- **Code:** redeploy the previous deployment in Vercel. The shared keys and the website are unaffected either way.
- **Database (destructive: disconnects everyone who signed in; existing tables are not touched):**

```sql
BEGIN;
DROP TABLE IF EXISTS "McpToken" CASCADE;
DROP TABLE IF EXISTS "McpAuthCode" CASCADE;
DROP TABLE IF EXISTS "McpOAuthClient" CASCADE;
COMMIT;
```

## Emergency stops

- **One person:** Connected apps, **Revoke**. Or delete their admin login.
- **Everyone who signed in:** `UPDATE "McpToken" SET "revokedAt" = now() WHERE "revokedAt" IS NULL;`
- **The shared keys:** change `MCP_API_KEY` and/or `TRACKER_MCP_API_KEY` in Vercel and redeploy. (These are separate from sign-in.)

## Known limits

- Access renews while it is used and lapses after 30 days unused; each access token lasts one hour (Claude renews it quietly).
- The Connected apps page lists sign-in connections only. Shared-key connections cannot be listed (they are one key); switch them off by changing the key.
- Rate limiting on registration and token calls is per running server instance (best effort). The real protection is that a person who is
  signed in must click Allow, the return address must be on the allow-list, codes work once and expire in a minute, and tokens are stored only as hashes.
- Anyone can register an app (that is how the standard works), but registering grants nothing. Unused registrations are removed after 7 days.
- Reusing a one-time code is refused, but it does not also disconnect the person it was issued to.
- Local checks: `scripts/check-mcp-oauth-service.ts` (39 checks, database only) and `scripts/check-mcp-oauth-flow.ts` (HTTP checks against a running local server). Both refuse to run against anything but localhost.
