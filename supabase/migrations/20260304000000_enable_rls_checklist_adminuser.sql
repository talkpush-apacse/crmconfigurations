-- Migration: 20260304000000_enable_rls_checklist_adminuser.sql
-- Rollback:
--   ALTER TABLE "Checklist" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "AdminUser" DISABLE ROW LEVEL SECURITY;

-- Enable RLS on Checklist table.
-- All app queries go through Prisma (direct Postgres connection, superuser role)
-- which bypasses RLS. This blocks unauthenticated PostgREST access to raw table data.
ALTER TABLE "Checklist" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on AdminUser table.
-- This prevents direct PostgREST reads of email addresses and password hashes.
ALTER TABLE "AdminUser" ENABLE ROW LEVEL SECURITY;

-- No permissive policies are added. Default RLS behaviour is deny-all for
-- the anon and authenticated PostgREST roles. Prisma (postgres superuser)
-- is unaffected and continues to have full access.
