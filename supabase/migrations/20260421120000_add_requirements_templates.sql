-- Migration: 20260421120000_add_requirements_templates.sql
-- Rollback: DROP TABLE IF EXISTS "RequirementsTemplate";

CREATE TABLE IF NOT EXISTS "RequirementsTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "tabName" TEXT NOT NULL,
  "tabDescription" TEXT,
  "tabIcon" TEXT,
  "fields" JSONB NOT NULL,
  "validationGroups" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RequirementsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RequirementsTemplate_archived_updatedAt_idx"
  ON "RequirementsTemplate"("archived", "updatedAt");

CREATE INDEX IF NOT EXISTS "RequirementsTemplate_name_idx"
  ON "RequirementsTemplate"("name");
