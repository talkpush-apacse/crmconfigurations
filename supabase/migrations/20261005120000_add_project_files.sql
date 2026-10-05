-- Migration: 20261005120000_add_project_files.sql
--
-- Adds files to Project Tracker projects (contracts, Gantt charts, notes):
--   1. ONE new table, "TrackerProjectFile" (an index of the files; the bytes live in storage).
--   2. ONE new PRIVATE storage bucket, "project-files" (not public: files open only through short-lived signed links
--      that the app hands to a signed-in staff member).
-- It changes NO existing table, drops nothing, and touches no existing bucket (branding-assets stays as it is).
-- Safe to run more than once (every statement is IF NOT EXISTS or guarded), and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- The table section was generated with `prisma migrate diff` between the previous prisma/schema.prisma and the
-- current one, then made re-runnable and given row-level security.
--
-- How to run: paste the whole file into the Supabase SQL editor and click Run.
--
-- Check BEFORE (both should return no rows / false):
--   SELECT to_regclass('public."TrackerProjectFile"');            -- null
--   SELECT id, public FROM storage.buckets WHERE id = 'project-files';   -- no rows
-- Check AFTER:
--   SELECT to_regclass('public."TrackerProjectFile"');            -- "TrackerProjectFile"
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'project-files';  -- project-files | false | 26214400
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public."TrackerProjectFile"'::regclass;  -- true
--
-- Rollback (destructive: forgets every file's index row; run only if needed. Empty the bucket in the Supabase
-- Storage screen first, because a bucket that still holds files cannot be deleted):
--   BEGIN;
--   DROP TABLE IF EXISTS "TrackerProjectFile" CASCADE;
--   DELETE FROM storage.buckets WHERE id = 'project-files';
--   COMMIT;

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'contract',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "note" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerProjectFile_storagePath_key" ON "TrackerProjectFile"("storagePath");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerProjectFile_projectId_archived_createdAt_idx" ON "TrackerProjectFile"("projectId", "archived", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerProjectFile_projectId_fkey' AND conrelid = 'public."TrackerProjectFile"'::regclass
  ) THEN
    ALTER TABLE "TrackerProjectFile" ADD CONSTRAINT "TrackerProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security: same pattern as the other tracker tables. The app reads and writes through Prisma (a direct
-- connection that bypasses RLS); with RLS on and no policies, Supabase's public data API cannot read this table.
ALTER TABLE "TrackerProjectFile" ENABLE ROW LEVEL SECURITY;

-- The private bucket. Created only where Supabase Storage exists, so this file also runs on a plain Postgres
-- database (a local test copy). public = false, so there is no permanent public address for any file.
-- file_size_limit 26214400 = 25 MB, enforced by storage itself, not only by the app.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('project-files', 'project-files', false, 26214400)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
