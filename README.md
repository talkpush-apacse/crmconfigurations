# Talkpush Implementation Hub

Two modules behind one login: the **CRM Config Checklist** and the **Project Tracker**. (This site was called "CRM Config Checklist" before the Hub existed.)

Next.js 16 + Prisma + Supabase app for managing CRM configuration checklists.

## Getting Started

New here? Follow [docs/getting-started-new-developer.md](docs/getting-started-new-developer.md). It covers forking,
building a throwaway local database (the app needs Postgres with SSL on), the `.env` file, a local login, and the
checks to run before a pull request.

Do **not** run `npx prisma migrate dev` or `prisma migrate deploy` to set up a database: they fail on a fresh
database (two old migrations share a timestamp), and pointed at a live URL they would change live data. See
"Local development" below.

## Environment Variables

Core app:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `ADMIN_SECRET`

Google admin sign-in:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Owner notifications:

- `APP_BASE_URL`
- `BREVO_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

Optional external cron:

- `CRON_SECRET`

`NOTIFICATION_FROM_EMAIL` must be a verified Brevo sender, for example an address under `updates.se-talkpush.com`.

## Owner Notifications

Each checklist can optionally define an `ownerEmail`. When present:

- file uploads send an immediate email
- regular edits are debounced per tab and flush after 5 minutes of inactivity
- digests are rate-limited to at most 1 email per tab per hour
- dispatch is self-triggered by successful checklist saves and uploads, so no Vercel cron is required

To disable notifications for a checklist, clear the `ownerEmail` field.

## Known Edge Case

The self-dispatch model only sweeps when some save or upload occurs. If the very last edit in the entire system is never followed by another write, that final digest may remain unsent.

If that becomes a problem, point an external cron at:

```text
GET /api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```

Run it every 5 minutes from any external scheduler such as GitHub Actions or cron-job.org.

## Cron Endpoint

`/api/cron/notifications` runs the same notification sweep used by the self-dispatch path and returns a JSON summary of:

- `scanned`
- `sent`
- `failed`
- `skippedRateLimited`
- `skippedVersionConflict`

## Project Tracker

A second module next to the CRM Config Checklist. After login you land on `/admin/home` and pick a module.
The tracker follows client implementation projects: accounts, projects, phases, open items (status, owner,
dates, dependencies, remarks), success metrics, and what clients may see.

- **Staff pages:** `/admin/tracker` (Portfolio, Accounts, Team) and `/admin/tracker/projects/[id]` with
  Summary, List, Board, Timeline, Metrics and Activity tabs.
- **Client links:** read-only `/share/<private link>`, created from a project's **Share** button. Links expire
  (90 days by default), can be revoked, and only ever show client-visible items, metrics and shared remarks.
  Design rules: `DESIGN.md` (staff = Talkpush Sign palette, client = executive-report palette).
- **Claude (MCP):** `/api/mcp/tracker`. Colleagues connect by signing in (no key); the shared key still works. See `docs/mcp-sign-in-release.md`, `docs/adding-an-mcp-tool.md` and `.claude/skills/project-tracker-mcp/SKILL.md`.
- **Code layout:** all rules live in `src/lib/tracker/` (pure, tested functions plus a thin database layer).
  The website, the staff API (`src/app/api/tracker/**`) and the MCP tools all call the same layer.

### Environment variables

| Name | Purpose |
|---|---|
| `TRACKER_MCP_API_KEY` | Key for `/api/mcp/tracker` (24+ characters; keep separate from `MCP_API_KEY`) |
| `TRACKER_TIMEZONE` | Optional IANA time zone for "today" (default UTC), for example `Asia/Manila` |

### Local development (read this: `npm run dev` can hit live data)

`.env.local` points `DATABASE_URL_DIRECT` at the production Supabase database, and Next.js loads it over `.env`.
Do not develop against it. Create a gitignored `.env.development.local` that overrides the database URL with a
local Postgres (SSL on, because `src/lib/db.ts` always uses SSL), and blank the Supabase storage keys so uploads
cannot reach the live bucket. Load the schema into the local database with:

```bash
DATABASE_URL_DIRECT=<local-url> npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script | psql <local-url>
```

(Keep the `DATABASE_URL_DIRECT=` prefix: without any `DATABASE_URL_DIRECT` set, the command exits with no error but prints an
empty script. The command only reads `prisma/schema.prisma`; it does not connect to that address.)

(`prisma migrate deploy` cannot build a fresh database: two old migrations share a timestamp.)

Useful scripts (all refuse to run unless the database is on localhost):

```bash
npx tsx scripts/seed-tracker-demo.ts          # one clearly fake demo project
npx tsx scripts/smoke-tracker-mcp.ts <url>    # 20 checks against the MCP endpoint
npx tsx scripts/check-share-links.ts          # share-link create, resolve, expire, revoke
npx tsx scripts/check-share-route.ts <url>    # public client link, over real HTTP
```

### Releasing

See [docs/project-tracker-release.md](docs/project-tracker-release.md): the Supabase SQL (additive, re-runnable,
rehearsed), Vercel variables, verification steps and rollback.

Named edit links and edit history: [docs/checklist-edit-history-release.md](docs/checklist-edit-history-release.md)
(2 new tables, no new variables). The tests that use a database (`tests/*-db.test.ts`) run only when
`WORKFLOW_TEST_DATABASE_URL` points at a **local** Postgres with `ssl = on`.
