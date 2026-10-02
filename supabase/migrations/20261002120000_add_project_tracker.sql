-- Migration: 20261002120000_add_project_tracker.sql
--
-- Adds the Project Tracker module: 11 NEW tables. It changes NO existing table and drops nothing.
-- Safe to run more than once (every statement is IF NOT EXISTS or guarded), and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- Generated with `prisma migrate diff` between the previous prisma/schema.prisma and the current one,
-- then made re-runnable and given row-level security (see the last section).
--
-- How to run: paste the whole file into the Supabase SQL editor and click Run.
-- Check before and after: see docs/project-tracker-release.md
--
-- Rollback (destructive: deletes all tracker data; existing tables are not touched). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "TrackerShareLink" CASCADE;
--   DROP TABLE IF EXISTS "TrackerActivity" CASCADE;
--   DROP TABLE IF EXISTS "TrackerMetricReading" CASCADE;
--   DROP TABLE IF EXISTS "TrackerMetric" CASCADE;
--   DROP TABLE IF EXISTS "TrackerRemark" CASCADE;
--   DROP TABLE IF EXISTS "TrackerItemDependency" CASCADE;
--   DROP TABLE IF EXISTS "TrackerItem" CASCADE;
--   DROP TABLE IF EXISTS "TrackerPhase" CASCADE;
--   DROP TABLE IF EXISTS "TrackerProject" CASCADE;
--   DROP TABLE IF EXISTS "TrackerPerson" CASCADE;
--   DROP TABLE IF EXISTS "TrackerAccount" CASCADE;
--   COMMIT;

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerPerson" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "side" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT,
    "organisation" TEXT,
    "adminUserId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerProject" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" DATE,
    "targetDate" DATE,
    "originalTargetDate" DATE,
    "goLiveDate" DATE,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "healthOverride" TEXT,
    "healthOverrideNote" TEXT,
    "sponsorPersonId" TEXT,
    "ownerPersonId" TEXT,
    "checklistId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE,
    "endDate" DATE,
    "exitCriteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'config',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "visibility" TEXT NOT NULL DEFAULT 'client_visible',
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "ownerPersonId" TEXT,
    "startDate" DATE,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "blockerReason" TEXT,
    "waitingOn" TEXT,
    "externalDependency" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "checklistTabSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdVia" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerItemDependency" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "blockedByItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerItemDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerRemark" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "authorLabel" TEXT NOT NULL,
    "createdVia" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerRemark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'higher_is_better',
    "baselineValue" DOUBLE PRECISION,
    "baselineDate" DATE,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "currentAsOf" DATE,
    "source" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'client_visible',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerMetricReading" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "asOf" DATE NOT NULL,
    "note" TEXT,
    "createdVia" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerMetricReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorLabel" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerShareLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "personId" TEXT,
    "label" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerAccount_slug_key" ON "TrackerAccount"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerAccount_name_idx" ON "TrackerAccount"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerPerson_accountId_idx" ON "TrackerPerson"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerPerson_side_idx" ON "TrackerPerson"("side");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerProject_accountId_idx" ON "TrackerProject"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerProject_status_archived_idx" ON "TrackerProject"("status", "archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerPhase_projectId_sortOrder_idx" ON "TrackerPhase"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItem_projectId_status_idx" ON "TrackerItem"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItem_projectId_sortOrder_idx" ON "TrackerItem"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItem_ownerPersonId_idx" ON "TrackerItem"("ownerPersonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItem_dueDate_idx" ON "TrackerItem"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItemDependency_blockedByItemId_idx" ON "TrackerItemDependency"("blockedByItemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerItemDependency_itemId_blockedByItemId_key" ON "TrackerItemDependency"("itemId", "blockedByItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerRemark_itemId_createdAt_idx" ON "TrackerRemark"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerMetric_projectId_sortOrder_idx" ON "TrackerMetric"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerMetricReading_metricId_asOf_idx" ON "TrackerMetricReading"("metricId", "asOf");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerActivity_projectId_createdAt_idx" ON "TrackerActivity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerActivity_entityType_entityId_idx" ON "TrackerActivity"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerShareLink_tokenHash_key" ON "TrackerShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerShareLink_projectId_idx" ON "TrackerShareLink"("projectId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerPerson_accountId_fkey' AND conrelid = 'public."TrackerPerson"'::regclass
  ) THEN
    ALTER TABLE "TrackerPerson" ADD CONSTRAINT "TrackerPerson_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TrackerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerProject_accountId_fkey' AND conrelid = 'public."TrackerProject"'::regclass
  ) THEN
    ALTER TABLE "TrackerProject" ADD CONSTRAINT "TrackerProject_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TrackerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerProject_sponsorPersonId_fkey' AND conrelid = 'public."TrackerProject"'::regclass
  ) THEN
    ALTER TABLE "TrackerProject" ADD CONSTRAINT "TrackerProject_sponsorPersonId_fkey" FOREIGN KEY ("sponsorPersonId") REFERENCES "TrackerPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerProject_ownerPersonId_fkey' AND conrelid = 'public."TrackerProject"'::regclass
  ) THEN
    ALTER TABLE "TrackerProject" ADD CONSTRAINT "TrackerProject_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "TrackerPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerPhase_projectId_fkey' AND conrelid = 'public."TrackerPhase"'::regclass
  ) THEN
    ALTER TABLE "TrackerPhase" ADD CONSTRAINT "TrackerPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerItem_projectId_fkey' AND conrelid = 'public."TrackerItem"'::regclass
  ) THEN
    ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerItem_phaseId_fkey' AND conrelid = 'public."TrackerItem"'::regclass
  ) THEN
    ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TrackerPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerItem_ownerPersonId_fkey' AND conrelid = 'public."TrackerItem"'::regclass
  ) THEN
    ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "TrackerPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerItemDependency_itemId_fkey' AND conrelid = 'public."TrackerItemDependency"'::regclass
  ) THEN
    ALTER TABLE "TrackerItemDependency" ADD CONSTRAINT "TrackerItemDependency_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerItemDependency_blockedByItemId_fkey' AND conrelid = 'public."TrackerItemDependency"'::regclass
  ) THEN
    ALTER TABLE "TrackerItemDependency" ADD CONSTRAINT "TrackerItemDependency_blockedByItemId_fkey" FOREIGN KEY ("blockedByItemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerRemark_itemId_fkey' AND conrelid = 'public."TrackerRemark"'::regclass
  ) THEN
    ALTER TABLE "TrackerRemark" ADD CONSTRAINT "TrackerRemark_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerMetric_projectId_fkey' AND conrelid = 'public."TrackerMetric"'::regclass
  ) THEN
    ALTER TABLE "TrackerMetric" ADD CONSTRAINT "TrackerMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerMetricReading_metricId_fkey' AND conrelid = 'public."TrackerMetricReading"'::regclass
  ) THEN
    ALTER TABLE "TrackerMetricReading" ADD CONSTRAINT "TrackerMetricReading_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "TrackerMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerActivity_projectId_fkey' AND conrelid = 'public."TrackerActivity"'::regclass
  ) THEN
    ALTER TABLE "TrackerActivity" ADD CONSTRAINT "TrackerActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerShareLink_projectId_fkey' AND conrelid = 'public."TrackerShareLink"'::regclass
  ) THEN
    ALTER TABLE "TrackerShareLink" ADD CONSTRAINT "TrackerShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrackerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerShareLink_personId_fkey' AND conrelid = 'public."TrackerShareLink"'::regclass
  ) THEN
    ALTER TABLE "TrackerShareLink" ADD CONSTRAINT "TrackerShareLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrackerPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


-- Row-level security.
-- All app queries go through Prisma (direct Postgres connection, superuser role), which bypasses RLS.
-- Turning it on with no policies blocks unauthenticated access to these tables through Supabase's
-- public data API (anon/authenticated roles). Same pattern as 20260429000000_enable_rls_checklistsnapshot_prismamigrations.sql.
ALTER TABLE "TrackerAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerProject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerPhase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerItemDependency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerRemark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerMetricReading" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerShareLink" ENABLE ROW LEVEL SECURITY;

COMMIT;
