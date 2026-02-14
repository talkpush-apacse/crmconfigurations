import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

  const info: Record<string, unknown> = {
    hasDirectUrl: !!process.env.DATABASE_URL_DIRECT,
    hasDbUrl: !!process.env.DATABASE_URL,
    urlPrefix: connectionString ? connectionString.substring(0, 15) + "..." : "NOT SET",
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });

    const result = await pool.query("SELECT NOW() as time, current_database() as db");
    info.dbConnected = true;
    info.dbTime = result.rows[0].time;
    info.dbName = result.rows[0].db;

    // Check if tables exist
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    info.tables = tables.rows.map((r: { table_name: string }) => r.table_name);

    // Check admin user count
    try {
      const adminCount = await pool.query(`SELECT COUNT(*) as count FROM "AdminUser"`);
      info.adminUserCount = adminCount.rows[0].count;
    } catch (e) {
      info.adminUserError = (e as Error).message;
    }

    await pool.end();
  } catch (e) {
    info.dbConnected = false;
    info.dbError = (e as Error).message;
  }

  return NextResponse.json(info);
}
