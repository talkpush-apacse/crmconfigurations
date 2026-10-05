-- Migration: 20261005140000_add_admin_user_role.sql
--
-- Adds a "role" to each login so some Talkpush colleagues can be read-only:
--   editor  = can change things (what every login can do today)
--   viewer  = can look at everything but cannot change anything
-- ONE new column on "AdminUser". Every existing login becomes 'editor', so nobody loses any access.
-- Nothing else changes. Safe to run more than once, and it runs as one transaction.
--
-- How to run: paste the whole file into the Supabase SQL editor and click Run.
--
-- Check BEFORE (expect: no rows):
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'AdminUser' AND column_name = 'role';
-- Check AFTER (expect: every existing login shows editor):
--   SELECT email, role FROM "AdminUser" ORDER BY "createdAt";
--
-- Rollback (removes the roles; every login goes back to full access):
--   ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "role";

BEGIN;

ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'editor';

-- Only the two known roles can be stored, even if something writes to the table directly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdminUser_role_check' AND conrelid = 'public."AdminUser"'::regclass
  ) THEN
    ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_role_check" CHECK ("role" IN ('editor', 'viewer'));
  END IF;
END $$;

COMMIT;
