# Getting started: new developer

> The setup steps were tested on 2026-10-06 on a fresh clone of `main` (macOS, Node 24, Postgres 17).
> The "Rules of the road" section is the working agreement for outside contributors. A follow-up should copy the same
> rules into a `CLAUDE.md` at the repo root so Claude Code follows them automatically.

This is the **Talkpush Implementation Hub**: a Next.js 16 + Prisma + Postgres app with three modules behind one login:
the CRM Config Checklist, the Project Tracker and the Workflow Builder. Read `README.md`, `PRODUCT.md` and `DESIGN.md`
first for what each module is for.

By the end of this page you will have the app running on your own computer, against your own throwaway database, with
no access to any live system.

---

## 1. What you need (and what you do not)

You need:

- A **GitHub account** (free). You work on your **own fork** of `talkpush-apacse/crmconfigurations` and send changes
  to Jolo as pull requests. You are not added as a collaborator and cannot push to Jolo's repository directly.
- **Claude Code** with your own Claude plan or API access.
- A Mac (tested) or any computer that can run the tools below.

You do **not** get, and do not need:

- The live database (Supabase), the Vercel project, or any production keys.
- Jolo's local files. Everything you need is in the repository.

If anything below asks for a production URL or key, stop and ask Jolo.

## 2. Install the tools

| Tool | Version | macOS install |
|---|---|---|
| Node.js | 20.9 or newer (24 tested) | `brew install node` |
| git | any recent | `brew install git` (or Xcode command line tools) |
| PostgreSQL | 16 or 17 (17 tested) | `brew install postgresql@17` |
| GitHub CLI (optional) | any | `brew install gh`, then `gh auth login` |

Then put Postgres on your path (add this line to `~/.zshrc` to keep it):

```bash
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
```

Docker is not needed.

## 3. Fork and get the code

1. Open https://github.com/talkpush-apacse/crmconfigurations and click **Fork** (top right), then **Create fork**.
   You now have your own copy at `github.com/<your-username>/crmconfigurations`.
2. Clone **your fork** (replace `<your-username>`), and add Jolo's repository as `upstream` so you can pick up his
   latest changes:

```bash
git clone https://github.com/<your-username>/crmconfigurations.git
cd crmconfigurations
git remote add upstream https://github.com/talkpush-apacse/crmconfigurations.git
npm ci
```

`npm ci` installs exactly what `package-lock.json` says. It also generates the database client automatically. No env
file is needed for this step.

### Your day-to-day loop

```bash
# 1. start each piece of work from Jolo's latest main
git fetch upstream
git checkout -b feat/short-description upstream/main

# 2. work, test (section 7), commit
git add -A && git commit -m "What changed, in one line"

# 3. push the branch to YOUR fork, never to upstream
git push -u origin feat/short-description
```

Then open GitHub, go to your fork, and click **Compare & pull request**. Check that the base repository says
`talkpush-apacse/crmconfigurations` and the base branch says `main`, add a short description of what to click to check
it, and submit. Jolo reviews and merges.

If a pull request needs changes, commit more to the same branch and push again; the pull request updates itself. Once
it is merged, start the next piece of work from step 1.

> `origin` is your fork and `upstream` is Jolo's repository. Never run `git push upstream`.

## 4. Create your own throwaway database

The app always connects to Postgres **with SSL switched on**, so a plain local Postgres will not work until SSL is on.
This sets up a separate database in your home folder (it will not touch any other Postgres on your machine):

```bash
initdb -D ~/crm-dev-pg -A trust -U postgres

# a self-signed certificate, good for 1 year, local use only
openssl req -new -x509 -days 365 -nodes -text -out ~/crm-dev-pg/server.crt \
  -keyout ~/crm-dev-pg/server.key -subj "/CN=localhost"
chmod 600 ~/crm-dev-pg/server.key

cat >> ~/crm-dev-pg/postgresql.conf <<'EOF'
port = 54329
listen_addresses = 'localhost'
unix_socket_directories = ''
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
EOF

pg_ctl -D ~/crm-dev-pg -l ~/crm-dev-pg/pg.log start
createdb -h localhost -p 54329 -U postgres crm_dev
```

Load the tables (the app's full schema, from `prisma/schema.prisma`):

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  | psql "postgresql://postgres@localhost:54329/crm_dev" -v ON_ERROR_STOP=1 -q
```

Success looks like: no errors, and this prints `32` (or more, if tables have been added since):

```bash
psql "postgresql://postgres@localhost:54329/crm_dev" -tAc "select count(*) from pg_tables where schemaname='public'"
```

Do **not** use `npx prisma migrate dev` or `prisma migrate deploy` to build this database. They fail on a fresh
database (two old migrations share a timestamp), and run against a live URL they would change live data. `README.md`
still lists `migrate dev` under "Getting Started"; ignore that line.

To stop or start the database later:

```bash
pg_ctl -D ~/crm-dev-pg stop
pg_ctl -D ~/crm-dev-pg -l ~/crm-dev-pg/pg.log start
```

## 5. Create your `.env` file

Create a file called `.env` in the project folder. It is already in `.gitignore`, so it will not be committed.

```bash
cat > .env <<EOF
DATABASE_URL=postgresql://postgres@localhost:54329/crm_dev
DATABASE_URL_DIRECT=postgresql://postgres@localhost:54329/crm_dev
ADMIN_SECRET=$(openssl rand -base64 48 | tr -d '\n')
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EOF
```

- `ADMIN_SECRET` signs login cookies. It must be a random string of 32+ characters (the command above makes one).
- The two blank Supabase lines are on purpose: they mean file uploads cannot reach any real storage.
- Everything else in `.env.example` (Google sign-in, Brevo email, MCP keys, cron) is optional for local work.

**Never put a production database URL in any env file on your computer.** Nothing in the app stops you from doing it,
and a local test that writes would then change real client data.

## 6. Seed a login and start the app

```bash
npm run db:seed        # creates the local-only login admin@talkpush.com / admin123
npm run dev
```

Open http://localhost:3000/admin/login and sign in with `admin@talkpush.com` / `admin123`. That login exists only in
your local database.

Success looks like: you land on **Pick a module**, and the CRM Config Checklist, Project Tracker and Workflow Builder
all open (they will be empty).

Optional: add the ten starter Workflow Builder templates (the script refuses to run unless the database is on
localhost):

```bash
npx tsx scripts/seed-workflow-templates.ts
```

## 7. Checks before you open a pull request

```bash
DATABASE_URL_DIRECT="postgresql://postgres@localhost:54329/crm_dev" npm test
npm run build
npx tsc --noEmit
```

What to expect on `main` as of 2026-10-06:

- `npm test` needs `DATABASE_URL_DIRECT` set **in the shell** (the test runner does not read `.env`). With it:
  about 476 pass, 26 are skipped (the skipped ones need extra database variables), 0 fail.
- `npm run build` passes.
- `npx tsc --noEmit` prints nothing (no type errors).
- `npm run lint` currently reports 28 errors that already existed. Do not add new ones.

The 26 skipped tests are the database-backed ones. To run them, give them your local URL as well:

```bash
URL="postgresql://postgres@localhost:54329/crm_dev"
DATABASE_URL_DIRECT=$URL TRACKER_TEST_DATABASE_URL=$URL WORKFLOW_TEST_DATABASE_URL=$URL npm test
```

Some of those fail on a fresh database. When last checked (2026-10-06, just before PR #66 merged), 9 Workflow tests
failed. At least one fails because the test signs in as a user that is not in the database, and the app now checks
that the user exists. If you see `401 !== 201` or "This login no longer has access", that is the cause, not your
change.

## 8. Using Claude Code on this project

```bash
cd crmconfigurations
claude
```

Tell Claude at the start: "Push only to `origin` (my fork), never to `upstream`. Do not run any command against a
database other than the local one in `.env`."

- The repository ships project skills in `.claude/skills/` (for example `project-tracker-mcp`). Claude Code loads them
  automatically.
- Good first prompt: "Read README.md, PRODUCT.md, DESIGN.md and docs/getting-started-new-developer.md, then tell me how
  the three modules fit together."
- Ask Claude to explain a plan before it edits, and to run the checks in section 7 before you open a pull request.

Where things live:

| Folder | What is in it |
|---|---|
| `src/app/` | Pages and API routes |
| `src/lib/tracker/` | Project Tracker rules (plain functions, tested) plus a thin database layer |
| `src/lib/workflow/` | Workflow Builder |
| `src/components/` | Screens and UI pieces |
| `prisma/schema.prisma` | The database model |
| `supabase/migrations/` | SQL files applied to the live database, by Jolo only |
| `tests/` | All tests |
| `docs/` | Release runbooks and module specs |

## 9. Rules of the road (proposed)

1. **Never push to Jolo's repository.** Work on a branch (`feat/...`, `fix/...`) in your own fork and open a pull
   request into `talkpush-apacse/crmconfigurations` `main`. Jolo reviews and merges.
2. **Never deploy.** Merging is Jolo's call; he checks the live site afterwards.
3. **Never touch the live database.** No SQL, no `prisma migrate`, no scripts pointed at Supabase. If a change needs a
   new table or column, add a SQL file in `supabase/migrations/` and a matching change in `prisma/schema.prisma`, and say
   so in the pull request. Jolo applies SQL to the live database only after approving it.
4. **Ask before** adding a library, changing a database table, changing a public link or API response, or changing
   how sign-in works.
5. **Keep secrets and client information out of git.** This repository may be visible outside Talkpush. Never commit
   keys, `.env` files, real client names, candidate data or screenshots of live data.
6. **Money, emails and sharing:** the app must not send emails on its own or expose staff-only information on client
   links. If a change touches share links or client views, say so in the pull request so it gets extra review.
7. **Small pull requests.** One topic each, with a short description of what to click to check it.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `ADMIN_SECRET must be at least 32 characters long` | Re-run the `.env` command in section 5. |
| `DATABASE_URL or DATABASE_URL_DIRECT is required` when running tests | Put `DATABASE_URL_DIRECT=...` in front of `npm test` (section 7). |
| `Connection refused` on port 54329 | The database is stopped. Start it with `pg_ctl` (section 4). |
| Postgres will not start: `postmaster became multithreaded during startup` | Run `export LC_ALL=en_US.UTF-8` and start it again. |
| `Port 3000 is in use` | `npm run dev -- -p 3100` and open that port instead. |
| Login says "Invalid credentials" | You skipped `npm run db:seed`, or you seeded a different database. |
| Pages show a database or SSL error | Check the SSL lines were added to `~/crm-dev-pg/postgresql.conf` and restart the database. |
