-- Migration: 20261005130000_add_item_staff_reviewed.sql
--
-- Phase 2 of the Implementation Plan work (clients add their own items).
--
-- What it does:
--   * 1 NEW nullable column on the existing "TrackerItem": "staffReviewedAt".
--     An item "needs review" when it was created by a client ("createdVia" = 'client') and this is empty.
--     Every existing row gets NULL and none of them was created by a client, so nothing changes for them.
--     No backfill, nothing rewritten (adding a nullable column in Postgres is instant).
-- It drops nothing, deletes nothing and adds no table. Safe to run more than once. Runs as one transaction.
--
-- Run it AFTER 20261005120000_add_implementation_plan_templates.sql (that one adds "templateItemKey").
--
-- Rollback (removes only the new empty column; no other data is touched). Run only if needed:
--   BEGIN;
--   ALTER TABLE "TrackerItem" DROP COLUMN IF EXISTS "staffReviewedAt";
--   COMMIT;

BEGIN;

-- AlterTable
ALTER TABLE "TrackerItem" ADD COLUMN IF NOT EXISTS "staffReviewedAt" TIMESTAMP(3);

COMMIT;

-- Check after running (read-only, run separately):
--   SELECT count(*) AS has_column FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'TrackerItem' AND column_name = 'staffReviewedAt';   -- expect 1
--   SELECT count(*) AS needs_review FROM "TrackerItem" WHERE "createdVia" = 'client' AND "staffReviewedAt" IS NULL;  -- expect 0 right after
--   SELECT count(*) AS item_rows FROM "TrackerItem";                                                      -- same number as before
