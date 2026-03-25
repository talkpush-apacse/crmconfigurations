-- Migration: 20260325120000_add_rbac.sql
-- Rollback:
--   DROP TABLE IF EXISTS "ChecklistAssignment";
--   ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "role";
--   DROP TYPE IF EXISTS "Role";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- AlterTable: Add role column to AdminUser, default existing users to ADMIN
ALTER TABLE "AdminUser" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "ChecklistAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistAssignment_userId_idx" ON "ChecklistAssignment"("userId");

-- CreateIndex
CREATE INDEX "ChecklistAssignment_checklistId_idx" ON "ChecklistAssignment"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAssignment_userId_checklistId_key" ON "ChecklistAssignment"("userId", "checklistId");

-- AddForeignKey
ALTER TABLE "ChecklistAssignment" ADD CONSTRAINT "ChecklistAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAssignment" ADD CONSTRAINT "ChecklistAssignment_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
