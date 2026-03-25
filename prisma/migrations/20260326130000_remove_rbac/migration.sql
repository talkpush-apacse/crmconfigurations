-- Migration: 20260326130000_remove_rbac.sql
-- Rollback: See migration 20260325120000_add_rbac for original schema

-- Drop the assignment junction table first (has foreign keys)
DROP TABLE IF EXISTS "ChecklistAssignment";

-- Remove the role column from AdminUser
ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "role";

-- Drop the Role enum type
DROP TYPE IF EXISTS "Role";
