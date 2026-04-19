import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const directUrl = process.env.DATABASE_URL_DIRECT;
  if (directUrl) {
    const pool = new Pool({
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 20000,
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }
  // No direct URL: fall back to standard client using DATABASE_URL (supports Accelerate)
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
