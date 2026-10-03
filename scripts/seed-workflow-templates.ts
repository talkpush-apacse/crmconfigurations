/**
 * Adds the ten starter Workflow Builder templates (skips any that already exist by name).
 *
 *   DATABASE_URL_DIRECT=postgresql://you@localhost:54329/tracker_dev npx tsx scripts/seed-workflow-templates.ts
 *
 * Safety: refuses to run against a database that is not on localhost unless you pass --allow-remote,
 * so a plain run can never write into the live Supabase database by accident.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { workflowTemplates } from "../src/lib/workflow/template-data";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  // handled below
}
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
if (!isLocal && !process.argv.includes("--allow-remote")) {
  console.error(`Refusing to seed: database host "${host || "unknown"}" is not localhost. Pass --allow-remote to override.`);
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  for (const t of workflowTemplates) {
    const existing = await prisma.workflowTemplate.findFirst({ where: { name: t.name } });
    if (existing) {
      console.log(`  Template "${t.name}" already exists - skipping`);
      continue;
    }
    await prisma.workflowTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        industry: t.industry,
        nodes: JSON.parse(JSON.stringify(t.nodes)),
        edges: JSON.parse(JSON.stringify(t.edges)),
      },
    });
    console.log(`  Created template: ${t.name}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
