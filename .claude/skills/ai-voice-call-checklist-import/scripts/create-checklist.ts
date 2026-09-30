/**
 * Creates a new checklist, mirroring POST /api/checklists exactly (see
 * src/app/api/checklists/route.ts) — there's no MCP tool for this yet, and no
 * admin session to call that route with directly from a script, so this
 * replicates its Prisma write instead.
 *
 * Usage (run from the crm-config-checklist repo root):
 *   DATABASE_URL_DIRECT="postgres://..." npx tsx \
 *     .claude/skills/ai-voice-call-checklist-import/scripts/create-checklist.ts \
 *     "Client Name" [enabledTab1 enabledTab2 ...]
 *
 * If no enabled tabs are passed, defaults to just ["prescreening"] — the only
 * standard tab an AI Voice Call checklist actually uses; every other standard
 * tab (Company Info, Users, Campaigns, etc.) is left off since it's noise for
 * this specific deliverable. Pass explicit tab slugs (see src/lib/tab-config.ts
 * for the full list) if this checklist should also cover full CRM onboarding.
 *
 * Checks for an existing checklist with the same slug first and refuses to
 * touch it — never silently overwrite a real client's existing checklist.
 */
import { prisma } from "../../../../src/lib/db";
import { getDefaultChecklistData } from "../../../../src/lib/template-data";

async function main() {
  const clientName = process.argv[2];
  if (!clientName) {
    console.error('Usage: npx tsx create-checklist.ts "Client Name" [enabledTab1 enabledTab2 ...]');
    process.exit(1);
  }
  const enabledTabs = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ["prescreening"];

  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.checklist.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Already exists — not touching it: slug "${slug}", id ${existing.id}`);
    console.log(existing.id);
    await prisma.$disconnect();
    return;
  }

  const defaults = getDefaultChecklistData();

  const checklist = await prisma.checklist.create({
    data: {
      slug,
      clientName,
      isCustom: false,
      enabledTabs: JSON.parse(JSON.stringify(enabledTabs)),
      companyInfo: JSON.parse(JSON.stringify(defaults.companyInfo)),
      users: JSON.parse(JSON.stringify(defaults.users)),
      campaigns: JSON.parse(JSON.stringify(defaults.campaigns)),
      sites: JSON.parse(JSON.stringify(defaults.sites)),
      prescreening: JSON.parse(JSON.stringify(defaults.prescreening)),
      messaging: JSON.parse(JSON.stringify(defaults.messaging)),
      sources: JSON.parse(JSON.stringify(defaults.sources)),
      folders: JSON.parse(JSON.stringify(defaults.folders)),
      documents: JSON.parse(JSON.stringify(defaults.documents)),
      attributes: JSON.parse(JSON.stringify(defaults.attributes)),
      fbWhatsapp: JSON.parse(JSON.stringify(defaults.fbWhatsapp)),
      instagram: JSON.parse(JSON.stringify(defaults.instagram)),
      aiCallFaqs: JSON.parse(JSON.stringify(defaults.aiCallFaqs)),
      agencyPortal: JSON.parse(JSON.stringify(defaults.agencyPortal)),
      labels: JSON.parse(JSON.stringify(defaults.labels)),
      adminSettings: JSON.parse(JSON.stringify(defaults.adminSettings)),
      atsIntegrations: JSON.parse(JSON.stringify(defaults.atsIntegrations)),
      integrations: JSON.parse(JSON.stringify(defaults.integrations)),
    },
  });

  console.log(`Created checklist "${clientName}" — slug: ${checklist.slug}, id: ${checklist.id}`);
  console.log(checklist.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
