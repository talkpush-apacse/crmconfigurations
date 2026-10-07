-- Migration: 20261007180000_add_company_level.sql
--
-- Company gallery, company level: a client company exists once ("Concentrix") and owns one account per geo
-- ("Concentrix PH", "Concentrix US"). Checklists, workflows and trackers keep linking to the account.
--
-- What it does:
--   * ONE new table, "TrackerCompany" (id, name, nameKey, timestamps), with row-level security turned on.
--     "nameKey" is the name lower-cased with punctuation and endings like Inc/Corp removed, and is UNIQUE: that is what
--     stops "Concentrix" and "Concentrix Inc." from becoming two companies.
--   * THREE new nullable columns on the existing "TrackerAccount": "companyId", "geo", "geoCode", an index on
--     "companyId", a foreign key to "TrackerCompany" (ON DELETE RESTRICT), and a unique index on ("companyId", "geoCode")
--     so a company has at most one account per geo. Rows with no company are not constrained (NULLs do not collide).
--   Every existing account gets NULL in all three, so nothing about existing accounts, names, checklists, workflows or
--   trackers changes. Nothing is backfilled or guessed. Adding nullable columns in Postgres is instant.
-- It drops nothing, deletes nothing, and touches no other table. Safe to run more than once. Runs as one transaction.
--
-- NOT APPLIED to any shared or production database. It must be applied BEFORE the pull request that reads these
-- columns is merged and deployed (the app selects them). To run for real: paste the whole file into the Supabase SQL
-- editor and click Run (only after Jolo approves).
--
-- Check BEFORE (both should return 0 / null):
--   SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
--     AND table_name = 'TrackerAccount' AND column_name IN ('companyId', 'geo', 'geoCode');          -- 0
--   SELECT to_regclass('public."TrackerCompany"');                                                    -- null
-- Check AFTER:
--   SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
--     AND table_name = 'TrackerAccount' AND column_name IN ('companyId', 'geo', 'geoCode');          -- 3 rows
--   SELECT to_regclass('public."TrackerCompany"');                                                    -- "TrackerCompany"
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public."TrackerCompany"'::regclass;             -- true
--   SELECT count(*) AS accounts_with_company FROM "TrackerAccount" WHERE "companyId" IS NOT NULL;      -- 0
--   SELECT count(*) AS account_rows FROM "TrackerAccount";                                            -- same number as before
--
-- Rollback (removes only what this adds; the accounts themselves are untouched):
--   BEGIN;
--   ALTER TABLE "TrackerAccount" DROP COLUMN IF EXISTS "companyId";
--   ALTER TABLE "TrackerAccount" DROP COLUMN IF EXISTS "geo";
--   ALTER TABLE "TrackerAccount" DROP COLUMN IF EXISTS "geoCode";
--   DROP TABLE IF EXISTS "TrackerCompany";
--   COMMIT;

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrackerCompany_nameKey_key" ON "TrackerCompany"("nameKey");

ALTER TABLE "TrackerCompany" ENABLE ROW LEVEL SECURITY;

-- AlterTable
ALTER TABLE "TrackerAccount" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "TrackerAccount" ADD COLUMN IF NOT EXISTS "geo" TEXT;
ALTER TABLE "TrackerAccount" ADD COLUMN IF NOT EXISTS "geoCode" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerAccount_companyId_idx" ON "TrackerAccount"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerAccount_companyId_geoCode_key" ON "TrackerAccount"("companyId", "geoCode");

-- AddForeignKey (guarded so the file can be run twice)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrackerAccount_companyId_fkey') THEN
    ALTER TABLE "TrackerAccount" ADD CONSTRAINT "TrackerAccount_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "TrackerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
