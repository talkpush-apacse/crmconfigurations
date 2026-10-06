-- Migration: 20261006150000_add_admin_user_super_admin.sql
--
-- Adds a "super admin" yes/no to each login:
--   isSuperAdmin = true  : a Talkpush Admin who can also add and remove super admins
--   isSuperAdmin = false : everyone else (what every login is today)
-- ONE new column on "AdminUser". Nobody's access changes: every existing login stays exactly as it is, except that
-- Step 2 makes jolo.yu@talkpush.com the first super admin.
--
-- IMPORTANT: run this BEFORE the code that reads the column is merged and deployed. The sign-in code reads the
-- whole login row, so deploying first would stop everyone signing in until the column exists.
--
-- How to run: paste the whole file into the Supabase SQL editor and click Run. Runs as one transaction and is
-- safe to run more than once.
--
-- Check BEFORE (expect: no rows):
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'AdminUser' AND column_name = 'isSuperAdmin';
-- Check AFTER (expect: every login false except jolo.yu@talkpush.com = true):
--   SELECT email, role, "isSuperAdmin" FROM "AdminUser" ORDER BY "createdAt";
--
-- Rollback (removes super admins; every login keeps its Editor / Read-only role):
--   ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "isSuperAdmin";

BEGIN;

-- Step 1: the column. Every existing login starts as NOT a super admin.
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: the first super admin. Only works for a login that is already a full editor.
UPDATE "AdminUser"
SET "isSuperAdmin" = true
WHERE lower("email") = 'jolo.yu@talkpush.com' AND "role" = 'editor';

COMMIT;
