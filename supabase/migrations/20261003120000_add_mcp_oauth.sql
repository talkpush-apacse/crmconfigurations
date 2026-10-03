-- Migration: 20261003120000_add_mcp_oauth.sql
--
-- Adds sign-in for the Claude connectors: 3 NEW tables. It changes NO existing table and drops nothing.
-- Safe to run more than once (every statement is IF NOT EXISTS or guarded) and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- Secrets are never stored: codes and tokens are saved only as SHA-256 hashes.
--
-- Rollback (destructive: disconnects everyone; existing tables are not touched). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "McpToken" CASCADE;
--   DROP TABLE IF EXISTS "McpAuthCode" CASCADE;
--   DROP TABLE IF EXISTS "McpOAuthClient" CASCADE;
--   COMMIT;

BEGIN;

-- One row per app that registered itself with us (claude.ai, Claude Desktop, Claude Code ...).
CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

-- A one-time code handed back after someone clicks Allow. Lives about a minute, usable once.
CREATE TABLE IF NOT EXISTS "McpAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'mcp',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAuthCode_pkey" PRIMARY KEY ("id")
);

-- One row per connected person and app. This is what the "Connected apps" list shows and what Revoke switches off.
CREATE TABLE IF NOT EXISTS "McpToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'mcp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "McpToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "McpAuthCode_codeHash_key" ON "McpAuthCode"("codeHash");
CREATE INDEX IF NOT EXISTS "McpAuthCode_expiresAt_idx" ON "McpAuthCode"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "McpToken_accessTokenHash_key" ON "McpToken"("accessTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "McpToken_refreshTokenHash_key" ON "McpToken"("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "McpToken_adminUserId_idx" ON "McpToken"("adminUserId");
CREATE INDEX IF NOT EXISTS "McpToken_clientId_idx" ON "McpToken"("clientId");

-- Foreign keys. The two to "AdminUser" mean: delete a person's admin login and their Claude connections go with it.
-- They are constraints on the NEW tables; "AdminUser" itself is not altered.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpAuthCode_clientId_fkey' AND conrelid = 'public."McpAuthCode"'::regclass) THEN
    ALTER TABLE "McpAuthCode" ADD CONSTRAINT "McpAuthCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpAuthCode_adminUserId_fkey' AND conrelid = 'public."McpAuthCode"'::regclass) THEN
    ALTER TABLE "McpAuthCode" ADD CONSTRAINT "McpAuthCode_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpToken_clientId_fkey' AND conrelid = 'public."McpToken"'::regclass) THEN
    ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'McpToken_adminUserId_fkey' AND conrelid = 'public."McpToken"'::regclass) THEN
    ALTER TABLE "McpToken" ADD CONSTRAINT "McpToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security, same pattern as the tracker tables: the app connects directly (bypasses RLS);
-- with no policies, Supabase's public data API cannot read these tables.
ALTER TABLE "McpOAuthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpAuthCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpToken" ENABLE ROW LEVEL SECURITY;

COMMIT;
