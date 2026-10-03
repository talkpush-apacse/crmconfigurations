/**
 * Rewrites the generated MCP tool lists from the tool definitions.
 * Run: npm run mcp:docs   (needs no database; it only reads the tool definitions)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Importing the tools loads the database client, which wants a URL even though nothing is queried.
process.env.DATABASE_URL ??= "postgresql://docs:docs@127.0.0.1:1/docs";

async function main() {
  const { renderTrackerToolsDoc, TRACKER_TOOLS_DOC_PATH } = await import("../src/lib/mcp/tracker/docs");
  const target = resolve(process.cwd(), TRACKER_TOOLS_DOC_PATH);
  writeFileSync(target, renderTrackerToolsDoc());
  console.log(`Wrote ${TRACKER_TOOLS_DOC_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
