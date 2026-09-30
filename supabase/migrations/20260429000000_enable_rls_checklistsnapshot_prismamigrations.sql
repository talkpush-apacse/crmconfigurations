-- Migration: 20260429000000_enable_rls_checklistsnapshot_prismamigrations.sql
-- Rollback:
--   ALTER TABLE "ChecklistSnapshot" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "_prisma_migrations" DISABLE ROW LEVEL SECURITY;

-- Enable RLS on ChecklistSnapshot table.
-- All app queries go through Prisma (direct Postgres connection, superuser role)
-- which bypasses RLS. This blocks unauthenticated PostgREST access to snapshot data.
ALTER TABLE "ChecklistSnapshot" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on _prisma_migrations (Prisma internal table).
-- This table contains only schema migration history, no sensitive app data.
-- Enabling RLS here silences the Security Advisor warning; Prisma superuser is unaffected.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- No permissive policies are added. Default RLS behaviour is deny-all for
-- the anon and authenticated PostgREST roles. Prisma (postgres superuser)
-- is unaffected and continues to have full access.
