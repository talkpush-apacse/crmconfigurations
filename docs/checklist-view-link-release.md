# Share this page (can-view and can-edit links): release runbook

Adds a **Share** button to the checklist page. It gives you two links to the tab you are on:

- **Can edit**: the checklist's existing editor link, pointed at that tab. (Named links for individual people are one click away.)
- **Can view**: a new read-only link. The person sees what the client sees and can change nothing. You turn it on when you need it, can give it a new address, and can turn it off at once.

**Nothing existing is removed or renamed.** The original editor link, named edit links and the client form link behave as before.

## What ships

| Area | Detail |
|---|---|
| Database | **1 new optional column**, `Checklist.viewToken`, plus a unique index on it. Empty for every existing checklist. No row is changed. Script: `supabase/migrations/20261008150000_add_checklist_view_token.sql` |
| Staff screens | **Share** button in the checklist header (in the ... menu on phones). Opens a panel with Can view / Can edit, a copy button for each, New address and Turn off for the view link |
| New page | `/view/<token>/<tab>`: the read-only page. Shows the tabs the client sees; tabs Talkpush fills in are left out. Shows a "View only" badge; no Save, Share, Export or upload controls |
| Header | Share and Export XLS now share one look in the Modern page look (the Export menu had lost the Modern button style) |
| Privacy | `/view/*` sends `no-referrer`, `no-store` and `noindex`. The view link is never returned by the client or editor links |
| Environment | No new variables |

## What the view link can and cannot do (say this to anyone who asks)

- It shows the **client slice** of the checklist: not the admin settings (telephony/SMS), integrations, owner email or internal notes.
- It **cannot save**: it is a different secret from the editor link, and every save route rejects it.
- **Turn off** clears the address, so it stops working at once. **New address** swaps it, so the old one stops working at once. Turning it on again makes a fresh address.
- Anyone who already has the address can open it until you turn it off or replace it. Links can be forwarded.
- Export to Excel is not offered on the view page in this release.
- Opening the view link is not recorded anywhere yet.

## Before you start

Merge only **after** the SQL below has been applied to Supabase. The app reads every column of a checklist, so if the new column is missing, **checklist pages would fail to load** for everyone until it exists. (Adding the column first is harmless: the current live code ignores it.)

## Step 1: apply the database change in Supabase

1. Open the Supabase project, then **SQL Editor**.
2. Run the BEFORE query and write down the number:
   ```sql
   SELECT count(*) AS checklists FROM "Checklist";
   SELECT column_name FROM information_schema.columns WHERE table_name = 'Checklist' AND column_name = 'viewToken';  -- expect no rows
   ```
3. Paste the whole of `supabase/migrations/20261008150000_add_checklist_view_token.sql` and click **Run**. It runs as one transaction and is safe to run twice.
4. Run the AFTER queries:
   ```sql
   SELECT count(*) AS checklists FROM "Checklist";                                              -- same number as before
   SELECT count(*) AS with_view_link FROM "Checklist" WHERE "viewToken" IS NOT NULL;            -- expect 0
   SELECT column_name FROM information_schema.columns WHERE table_name = 'Checklist' AND column_name = 'viewToken';  -- expect 1 row
   ```

## Step 2: merge and check

1. Merge the pull request. Vercel deploys it.
2. Open a checklist as staff, go to any tab, click **Share**.
3. **Can view** shows "The view link is off". Click **Create and copy**. Open the copied link in a private window: you should see the tab with a "View only" badge, and no Save, Share or Export buttons. Click into a cell: it does not change.
4. Click **New address**, confirm. Reload the private window with the OLD link: it says "This link is not available".
5. Click **Turn off**, confirm. The newest link now says the same.
6. Click **Copy link** under Can edit and open it in a private window: it opens the editor on the same tab.

## Rollback

Hide or turn off links from the panel first. To remove the column entirely (loses only the view links):

```sql
BEGIN;
DROP INDEX IF EXISTS "Checklist_viewToken_key";
ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "viewToken";
COMMIT;
```

Then redeploy the previous version of the app (the new code reads this column).
