-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "communicationChannels" JSONB,
ADD COLUMN     "enabledTabs" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
