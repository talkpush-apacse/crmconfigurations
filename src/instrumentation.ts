export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { Pool } = await import("pg");

  const connectionString =
    process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[startup] No DB connection string — skipping migrations");
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    // 20260417000000_add_google_auth
    await pool.query(`
      ALTER TABLE "AdminUser"
        ADD COLUMN IF NOT EXISTS "googleId" TEXT,
        ALTER COLUMN "passwordHash" DROP NOT NULL
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_googleId_key"
        ON "AdminUser"("googleId")
    `);

    // 20260418120000_add_autoflows
    await pool.query(`
      ALTER TABLE "Checklist"
        ADD COLUMN IF NOT EXISTS "autoflows" JSONB
    `);

    console.log("[startup] DB migrations applied");
  } catch (err) {
    console.error("[startup] Migration error:", err);
  } finally {
    await pool.end();
  }
}
