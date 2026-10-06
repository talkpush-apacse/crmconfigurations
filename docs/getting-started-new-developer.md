# Set up the project on your Mac: step by step

This guide is for a new developer who is not a software engineer. You do not need to understand the commands. You
copy each command, paste it, and check the result.

The project is the **Talkpush Implementation Hub**. It has three parts: the CRM Config Checklist, the Project
Tracker, and the Workflow Builder.

The commands in this guide were tested on 2026-10-06 on a Mac. They were tested on a clean copy of the project.

> **This guide is for a Mac.** If you use Windows or Linux, ask Jolo before you start.

---

## Read this first: the rules

You work in your **own copy** of the project. You send your changes to Jolo. Jolo checks them and adds them to the
live site.

1. **Do not change the live site.** You only work on your own computer.
2. **Do not use the live database.** You use a practice database on your own computer.
3. **Do not put passwords or keys in the project.** Do not put real client names or candidate data in the project
   either. The project is public. Anyone can read it.
4. **Send changes as a pull request.** Do not try to push to Jolo's project. Section 8 shows how.
5. **Ask Jolo first** if you want to add a new library, change a database table, or change how sign-in works.
6. **Keep each pull request small.** Do one topic in each pull request.

> **WARNING:** If any step asks for a key, a password, or a database address from Jolo, stop. Ask Jolo. This guide
> never needs them.

---

## Words used in this guide

| Word | Meaning |
|---|---|
| Terminal | A Mac app where you type commands. |
| Repository (repo) | The project folder, with all its history, on GitHub. |
| Fork | Your own copy of Jolo's repo, on your GitHub account. |
| Branch | A separate line of work. Your changes stay on it until Jolo adds them. |
| Pull request | A request to Jolo: "Please add my changes." |
| Database | The place where the app keeps its data. Yours is a practice one. |
| `.env` file | A small file with settings. It stays on your computer only. |
| Claude Code | The AI tool that can read and change the project with you. |

---

## 1. Make your accounts

1. Go to https://github.com. Make a free account.
2. Get a Claude plan or API access. Then install Claude Code. Follow the steps at https://claude.com/claude-code.

Result: you can sign in to GitHub, and you can open Claude Code.

## 2. Open Terminal

1. Press **Command + Space**.
2. Type `Terminal`.
3. Press **Return**.

Result: a window opens with a line of text and a blinking cursor.

To use a command in this guide:
1. Copy the command.
2. Click in the Terminal window.
3. Press **Command + V** to paste.
4. Press **Return**.

Some blocks have many lines. Paste the whole block. Then press **Return**.

## 3. Install the tools

You install four tools: Homebrew, Node, Git, and PostgreSQL.

### 3.1 Install Homebrew

1. Go to https://brew.sh.
2. Copy the install command from that page.
3. Paste it in Terminal. Press **Return**.
4. Follow the messages on the screen. Enter your Mac password if it asks.
5. When it finishes, it shows "Next steps". Run the commands it shows there.

Result: this command shows a version number.

```bash
brew --version
```

### 3.2 Install Node, Git, PostgreSQL, and the GitHub tool

```bash
brew install node git postgresql@17 gh
```

This takes some minutes. Wait until the cursor comes back.

Tell your Mac where to find PostgreSQL. Run this command one time:

```bash
echo 'export PATH="$(brew --prefix postgresql@17)/bin:$PATH"' >> ~/.zshrc
```

Then close Terminal. Open it again (section 2).

Result: this command shows a version number of 20.9 or higher.

```bash
node -v
```

Result: this command shows `psql (PostgreSQL) 17` and more text.

```bash
psql --version
```

### 3.3 Tell Git who you are

Replace the name and the email with yours. Use the email of your GitHub account.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 3.4 Sign in to GitHub from Terminal

```bash
gh auth login
```

Answer the questions like this:
1. Where do you use GitHub? Select **GitHub.com**.
2. Preferred protocol for Git operations? Select **HTTPS**.
3. Authenticate Git with your GitHub credentials? Enter **Y**.
4. How would you like to authenticate? Select **Login with a web browser**.
5. Copy the one-time code that Terminal shows. Press **Return**.
6. Paste the code in the browser page. Approve the sign-in.

Result: Terminal shows "Logged in as" and your GitHub name.

## 4. Fork the project and download it

### 4.1 Make your fork

1. Go to https://github.com/talkpush-apacse/crmconfigurations.
2. Click **Fork** (top right).
3. Click **Create fork**.

Result: you are on a page with your own user name: `github.com/<your-user-name>/crmconfigurations`.

### 4.2 Download your fork

Replace `<your-user-name>` with your GitHub user name. Run these commands one by one.

```bash
cd ~
git clone https://github.com/<your-user-name>/crmconfigurations.git
cd crmconfigurations
git remote add upstream https://github.com/talkpush-apacse/crmconfigurations.git
```

`origin` is now your fork. `upstream` is Jolo's project. You never send changes to `upstream`.

Install the project parts. This takes about a minute.

```bash
npm ci
```

Result: the last lines of the output say "Generated Prisma Client". There are no red error lines.

## 5. Make your practice database

The app needs a database. The commands below make a new one in a folder in your home folder. They do not change
anything else on your Mac.

### 5.1 Create it

Paste this block. Then press **Return**.

```bash
initdb -D ~/crm-dev-pg -A trust -U postgres

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
```

### 5.2 Start it and make the empty database

```bash
pg_ctl -D ~/crm-dev-pg -l ~/crm-dev-pg/pg.log start
createdb -h localhost -p 54329 -U postgres crm_dev
```

### 5.3 Add the tables

```bash
DATABASE_URL_DIRECT="postgresql://postgres@localhost:54329/crm_dev" \
  npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  | psql "postgresql://postgres@localhost:54329/crm_dev" -v ON_ERROR_STOP=1 -q
```

Paste all three lines together. If you leave out the first line, the command finishes with no error but adds no
tables.

Check the result with this command.

```bash
psql "postgresql://postgres@localhost:54329/crm_dev" -tAc "select count(*) from pg_tables where schemaname='public'"
```

Result: it shows a number of 32 or more.

> **CAUTION:** Do not run `npx prisma migrate dev` or `prisma migrate deploy`. They fail on a new database. They can
> also change live data.

### 5.4 Stop and start the database later

Your database stops when you restart your Mac. Start it again with this command.

```bash
pg_ctl -D ~/crm-dev-pg -l ~/crm-dev-pg/pg.log start
```

To stop it:

```bash
pg_ctl -D ~/crm-dev-pg stop
```

## 6. Make the `.env` file

This file tells the app to use your practice database. Run this block in the project folder.

```bash
cat > .env <<EOF
DATABASE_URL=postgresql://postgres@localhost:54329/crm_dev
DATABASE_URL_DIRECT=postgresql://postgres@localhost:54329/crm_dev
ADMIN_SECRET=$(openssl rand -base64 48 | tr -d '\n')
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EOF
```

The two empty lines are on purpose. They make sure file uploads cannot reach a real storage.

> **WARNING:** Never put a live database address in any `.env` file on your computer.

## 7. Start the app and sign in

### 7.1 Add a practice login

```bash
npm run db:seed
```

Result: Terminal shows `Created admin user: admin@talkpush.com / admin123`. This login exists only on your computer.

### 7.2 Start the app

```bash
npm run dev
```

Leave this Terminal window open. The app runs while the window is open.

### 7.3 Open the app

1. Open your browser.
2. Go to http://localhost:3000/admin/login.
3. Sign in with `admin@talkpush.com` and `admin123`.

Result: you see **Pick a module**. You can open the CRM Config Checklist, the Project Tracker, and the Workflow
Builder. They are empty. This is correct.

To stop the app: click in the Terminal window. Press **Control + C**.

Optional: add ten example templates to the Workflow Builder. Open a second Terminal window. Go to the project
folder. Run:

```bash
cd ~/crmconfigurations
npx tsx scripts/seed-workflow-templates.ts
```

## 8. Make a change and send it to Jolo

You do this each time you make a change.

### 8.1 Start from Jolo's latest version

Use a short name for the work. Example: `feat/clearer-button-text`.

```bash
cd ~/crmconfigurations
git fetch upstream
git checkout -b feat/short-name-here upstream/main
```

### 8.2 Make your change

Open Claude Code in the `crmconfigurations` folder. Tell it what you want. See section 9.

### 8.3 Check your work

Ask Claude Code to run these checks. Or run them yourself.

```bash
DATABASE_URL_DIRECT="postgresql://postgres@localhost:54329/crm_dev" npm test
npm run build
npx tsc --noEmit
```

What you should see:
- `npm test`: about 476 tests pass, 26 are skipped, and 0 fail.
- `npm run build`: it ends without errors.
- `npx tsc --noEmit`: it prints nothing. No output means no errors.

Known problems that are not yours:
- `npm run lint` shows 28 errors that were already there. Do not add new ones.
- Some Workflow tests that need a database fail on a new database. The message is
  "This login no longer has access". Ignore it.

### 8.4 Save your change and send it to your fork

```bash
git add -A
git commit -m "Write one short line about what changed"
git push -u origin feat/short-name-here
```

> **CAUTION:** Always type `origin` in the push command. Never type `upstream`.

### 8.5 Ask Jolo to add your change

1. Go to your fork on GitHub: `github.com/<your-user-name>/crmconfigurations`.
2. Click **Compare & pull request**.
3. Check the top of the page. It must say `base repository: talkpush-apacse/crmconfigurations` and `base: main`.
4. Write what you changed. Write what to click to check it.
5. Click **Create pull request**.

Jolo checks it. If Jolo asks for changes, make them on the same branch. Then run `git add -A`, `git commit`, and
`git push` again. The pull request updates by itself.

## 9. Use Claude Code

1. Open Claude Code in the `crmconfigurations` folder.
2. Start with this message. Copy it exactly.

```text
Read README.md, PRODUCT.md, DESIGN.md and docs/getting-started-new-developer.md.
Rules for this session:
- Push only to origin (my fork). Never push to upstream.
- Use only the practice database in my .env file (localhost). Never use any other database.
- Do not add libraries, change database tables, or change sign-in without asking me first.
- Explain your plan in simple words before you change any file.
- Before I make a pull request, run the checks in section 8.3 and tell me the result.
```

3. Then say what you want to change. Write it in plain words. Example: "Change the text of the Save button on the
   Project Tracker to Save changes."

You can ask Claude Code to do sections 8.4 and 8.5 for you. Say: "Commit my changes. Push the branch to origin.
Tell me the link to make the pull request."

Where things are, if Claude Code asks:

| Folder | What is in it |
|---|---|
| `src/app/` | Pages and API routes |
| `src/components/` | Screens and parts of screens |
| `src/lib/tracker/` | Rules for the Project Tracker |
| `src/lib/workflow/` | The Workflow Builder |
| `prisma/schema.prisma` | The database design |
| `supabase/migrations/` | SQL files for the live database. Only Jolo applies them. |
| `tests/` | All tests |

## 10. If something goes wrong

| What you see | What to do |
|---|---|
| `command not found: brew`, `node`, or `psql` | Close Terminal. Open it again. If it still fails, do section 3 again. |
| `ADMIN_SECRET must be at least 32 characters long` | Run the block in section 6 again. |
| `Connection refused` and `54329` | The database is stopped. Start it (section 5.4). |
| `postmaster became multithreaded during startup` | Run `export LC_ALL=en_US.UTF-8`. Then start the database again. |
| `Port 3000 is in use` | Run `npm run dev -- -p 3100`. Open http://localhost:3100/admin/login. |
| Sign in says "Invalid credentials" | Run `npm run db:seed` (section 7.1). |
| A page shows a database or SSL error | Check that section 5.1 finished. Then restart the database. |
| `DATABASE_URL or DATABASE_URL_DIRECT is required` in a test | Run the test command from section 8.3 exactly as shown. |
| Git asks for a user name and password | Run `gh auth login` again (section 3.4). |
| You are not sure what to do | Stop. Send Jolo a screenshot of the Terminal window. |
