-- Migration: 20261004130000_add_workflow_access.sql
--
-- Workflow Builder phase 2 (access, sharing, review). Needs 20261004120000_add_workflow_builder.sql first.
--   * 6 NEW tables: WorkflowLink, WorkflowMember, WorkflowSuggestion, WorkflowComment, WorkflowAuditEvent, WorkflowAccessRequest.
--   * Adds nullable/defaulted columns to the 3 workflow tables from phase 1 (WorkflowProject, WorkflowFeedback, WorkflowVersion).
--   * Changes NO CRM Checklist or Project Tracker table. Drops nothing. Backfills nothing.
-- Safe to run more than once, and it runs as one transaction: if anything fails, nothing is applied.
--
-- Generated with `prisma migrate diff`, then made re-runnable and given row-level security.
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves).
--
-- Rollback (destructive for phase 2 data only; phase 1 tables and their data stay). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "WorkflowLink" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowMember" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowSuggestion" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowComment" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowAuditEvent" CASCADE;
--   DROP TABLE IF EXISTS "WorkflowAccessRequest" CASCADE;
--   ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "revision", DROP COLUMN IF EXISTS "publishedVersionId", DROP COLUMN IF EXISTS "generalAccess", DROP COLUMN IF EXISTS "showFeasibility";
--   ALTER TABLE "WorkflowFeedback" DROP COLUMN IF EXISTS "versionId", DROP COLUMN IF EXISTS "memberId", DROP COLUMN IF EXISTS "linkId", DROP COLUMN IF EXISTS "adminId";
--   ALTER TABLE "WorkflowVersion" DROP COLUMN IF EXISTS "revision", DROP COLUMN IF EXISTS "createdByMemberId";
--   COMMIT;

BEGIN;

-- AlterTable
ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "generalAccess" TEXT NOT NULL DEFAULT 'restricted',
ADD COLUMN IF NOT EXISTS "publishedVersionId" TEXT,
ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "showFeasibility" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkflowFeedback" ADD COLUMN IF NOT EXISTS "adminId" TEXT,
ADD COLUMN IF NOT EXISTS "linkId" TEXT,
ADD COLUMN IF NOT EXISTS "memberId" TEXT,
ADD COLUMN IF NOT EXISTS "versionId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowVersion" ADD COLUMN IF NOT EXISTS "createdByMemberId" TEXT,
ADD COLUMN IF NOT EXISTS "revision" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowLink" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "editMode" TEXT NOT NULL DEFAULT 'direct',
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT,
    "passcodeHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowMember" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "editMode" TEXT NOT NULL DEFAULT 'direct',
    "canAcceptSuggestions" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "firstOpenedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowSuggestion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "authorMemberId" TEXT,
    "authorGuestName" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "ops" JSONB NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowComment" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "nodeId" TEXT,
    "edgeId" TEXT,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "versionId" TEXT,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "authorAdminId" TEXT,
    "authorMemberId" TEXT,
    "authorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowAuditEvent" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkflowAccessRequest" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowLink_tokenHash_key" ON "WorkflowLink"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowLink_workflowId_level_idx" ON "WorkflowLink"("workflowId", "level");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowMember_tokenHash_key" ON "WorkflowMember"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowMember_workflowId_idx" ON "WorkflowMember"("workflowId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowSuggestion_workflowId_status_idx" ON "WorkflowSuggestion"("workflowId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowComment_workflowId_status_idx" ON "WorkflowComment"("workflowId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowAuditEvent_workflowId_createdAt_idx" ON "WorkflowAuditEvent"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkflowAccessRequest_workflowId_status_idx" ON "WorkflowAccessRequest"("workflowId", "status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowLink_workflowId_fkey' AND conrelid = 'public."WorkflowLink"'::regclass
  ) THEN
    ALTER TABLE "WorkflowLink" ADD CONSTRAINT "WorkflowLink_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowMember_workflowId_fkey' AND conrelid = 'public."WorkflowMember"'::regclass
  ) THEN
    ALTER TABLE "WorkflowMember" ADD CONSTRAINT "WorkflowMember_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowSuggestion_workflowId_fkey' AND conrelid = 'public."WorkflowSuggestion"'::regclass
  ) THEN
    ALTER TABLE "WorkflowSuggestion" ADD CONSTRAINT "WorkflowSuggestion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowComment_workflowId_fkey' AND conrelid = 'public."WorkflowComment"'::regclass
  ) THEN
    ALTER TABLE "WorkflowComment" ADD CONSTRAINT "WorkflowComment_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowAuditEvent_workflowId_fkey' AND conrelid = 'public."WorkflowAuditEvent"'::regclass
  ) THEN
    ALTER TABLE "WorkflowAuditEvent" ADD CONSTRAINT "WorkflowAuditEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkflowAccessRequest_workflowId_fkey' AND conrelid = 'public."WorkflowAccessRequest"'::regclass
  ) THEN
    ALTER TABLE "WorkflowAccessRequest" ADD CONSTRAINT "WorkflowAccessRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security (same pattern as the other modules: app queries use a direct superuser connection and
-- bypass it; this blocks the Supabase public data API).
ALTER TABLE "WorkflowLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowSuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowAccessRequest" ENABLE ROW LEVEL SECURITY;

COMMIT;
