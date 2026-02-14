-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyInfo" JSONB,
    "users" JSONB,
    "campaigns" JSONB,
    "sites" JSONB,
    "prescreening" JSONB,
    "messaging" JSONB,
    "sources" JSONB,
    "folders" JSONB,
    "documents" JSONB,
    "fbWhatsapp" JSONB,
    "instagram" JSONB,
    "aiCallFaqs" JSONB,
    "agencyPortal" JSONB,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_slug_key" ON "Checklist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
