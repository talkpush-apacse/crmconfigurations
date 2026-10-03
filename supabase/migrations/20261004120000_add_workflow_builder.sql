-- Migration: 20261004120000_add_workflow_builder.sql
--
-- Adds the Workflow Builder module (phase 1): 5 NEW tables. It changes NO existing table and drops nothing.
-- Safe to run more than once (every statement is IF NOT EXISTS or guarded), and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- Generated with `prisma migrate diff` between the previous prisma/schema.prisma and the current one,
-- then made re-runnable and given row-level security (see the last section).
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves).
--
-- Rollback (destructive: deletes all workflow data; existing tables are not touched). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "WorkflowFeedback" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowVersion" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowScopingArtifact" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowProject" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowTemplate" CASCADE;
--   COMMIT;

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowProject" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateId" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    "pages" JSONB NOT NULL DEFAULT '[]',
    "shareToken" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "shareVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowScopingArtifact" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "owner" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowScopingArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT NOT NULL DEFAULT 'general',
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowFeedback" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerDetail" TEXT,
    "createdByName" TEXT,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "viewport" JSONB,
    "pages" JSONB,
    "nodeCount" INTEGER NOT NULL,
    "edgeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowProject_shareToken_key" ON "WorkflowProject"("shareToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowProject_clientName_idx" ON "WorkflowProject"("clientName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowProject_status_idx" ON "WorkflowProject"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowScopingArtifact_workflowId_kind_idx" ON "WorkflowScopingArtifact"("workflowId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowScopingArtifact_workflowId_status_idx" ON "WorkflowScopingArtifact"("workflowId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowScopingArtifact_workflowId_createdAt_idx" ON "WorkflowScopingArtifact"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowTemplate_industry_idx" ON "WorkflowTemplate"("industry");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowFeedback_workflowId_idx" ON "WorkflowFeedback"("workflowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowVersion_workflowId_versionNumber_idx" ON "WorkflowVersion"("workflowId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowVersion_workflowId_createdAt_idx" ON "WorkflowVersion"("workflowId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowProject_templateId_fkey' AND conrelid = 'public."WorkflowProject"'::regclass
  ) THEN
    ALTER TABLE "WorkflowProject" ADD CONSTRAINT "WorkflowProject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowScopingArtifact_workflowId_fkey' AND conrelid = 'public."WorkflowScopingArtifact"'::regclass
  ) THEN
    ALTER TABLE "WorkflowScopingArtifact" ADD CONSTRAINT "WorkflowScopingArtifact_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowFeedback_workflowId_fkey' AND conrelid = 'public."WorkflowFeedback"'::regclass
  ) THEN
    ALTER TABLE "WorkflowFeedback" ADD CONSTRAINT "WorkflowFeedback_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowVersion_workflowId_fkey' AND conrelid = 'public."WorkflowVersion"'::regclass
  ) THEN
    ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security.
-- All app queries go through Prisma (direct Postgres connection, superuser role), which bypasses RLS.
-- Turning it on with no policies blocks unauthenticated access to these tables through Supabase's
-- public data API (anon/authenticated roles). Same pattern as 20261002120000_add_project_tracker.sql.
ALTER TABLE "WorkflowProject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowScopingArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowVersion" ENABLE ROW LEVEL SECURITY;

COMMIT;
