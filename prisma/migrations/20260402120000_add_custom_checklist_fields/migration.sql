-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Checklist" ADD COLUMN "customSchema" JSONB;
ALTER TABLE "Checklist" ADD COLUMN "customData" JSONB;
