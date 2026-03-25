-- Migration: 20260326120000_add_editor_token.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "editorToken";

-- Add the editorToken column with a default UUID for new rows
ALTER TABLE "Checklist" ADD COLUMN "editorToken" TEXT UNIQUE DEFAULT gen_random_uuid();

-- Backfill existing rows that have NULL editorToken
UPDATE "Checklist" SET "editorToken" = gen_random_uuid() WHERE "editorToken" IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE "Checklist" ALTER COLUMN "editorToken" SET NOT NULL;
