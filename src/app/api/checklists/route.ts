import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { normalizeOwnerEmail } from "@/lib/notifications";
import { getDefaultChecklistData } from "@/lib/template-data";

/**
 * Strips fields that must never reach an unauthenticated slug-based viewer.
 *
 * Matches the equivalent helper in by-token/route.ts. Deny-listing on a full
 * row fetch (rather than a hand-typed `select` allow-list) means a new
 * checklist field is public by default and has to be deliberately excluded —
 * the safe default for a JSON blob whose shape keeps growing. The previous
 * allow-list here had drifted: `labels` was missing simply because it did not
 * exist when the list was last written, the same root cause that made the
 * Labels tab briefly unreachable everywhere.
 */
function omitInternalConfig<T extends Record<string, unknown>>(checklist: T) {
  const publicChecklist = { ...checklist };
  delete publicChecklist.atsIntegrations;
  delete publicChecklist.integrations;
  delete publicChecklist.configuratorChecklist;
  // editorToken must never be returned to slug-based public viewers
  delete publicChecklist.editorToken;
  // Internal telephony/SMS operational config — not shown to clients.
  delete publicChecklist.adminSettings;
  // Optimistic-concurrency bookkeeping — internal, not part of any tab's UI.
  delete publicChecklist.fieldVersions;
  // A real person's email address — must never go out on an unauthenticated,
  // slug-based public link. Caught by diffing this route's actual response
  // before/after switching off the `select` allow-list: the allow-list had
  // never selected `ownerEmail` or `notificationState`, so the full-row fetch
  // silently started returning them. Both are genuine Checklist columns, not
  // CHECKLIST_JSON_FIELDS entries, so they were outside the field list this
  // fix was reasoning about — worth remembering next time a `select` is
  // dropped in favour of a full fetch: audit every column on the model, not
  // just the JSON ones.
  delete publicChecklist.ownerEmail;
  // Per-tab edit/notify timestamps for the owner-email feature — internal
  // bookkeeping, not shown in any tab's UI.
  delete publicChecklist.notificationState;
  return publicChecklist;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    // Public: fetch a single checklist by slug (for client-facing pages).
    //
    // No `select` — the hand-typed allow-list this used to have was already
    // three fields behind the checklist's actual JSON columns (see
    // omitInternalConfig above). Fetching the full row and denying the
    // sensitive fields by name is the same pattern the sibling by-token
    // route already uses, and it can't silently drift out of sync again.
    if (slug) {
      const checklist = await prisma.checklist.findUnique({
        where: { slug },
      });
      if (!checklist) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(omitInternalConfig(checklist as unknown as Record<string, unknown>));
    }

    // Protected: list all checklists (all authenticated users see everything)
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.checklist.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, slug: true, editorToken: true, clientName: true, ownerEmail: true, createdAt: true, updatedAt: true, enabledTabs: true, communicationChannels: true, featureToggles: true, configuratorChecklist: true, version: true, isCustom: true, customSchema: true, customTabs: true },
        take: pageSize,
        skip,
      }),
      prisma.checklist.count(),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/checklists error:", message, err);
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { clientName, enabledTabs, communicationChannels, featureToggles, isCustom, customSchema, customTabs, ownerEmail } = body;

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    if (normalizedOwnerEmail.error) {
      return NextResponse.json({ error: normalizedOwnerEmail.error }, { status: 400 });
    }

    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await prisma.checklist.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "A checklist with this name already exists" }, { status: 409 });
    }

    const defaults = getDefaultChecklistData();

    // Custom checklists: no standard tabs, store custom schema
    const createData: Record<string, unknown> = {
      slug,
      clientName,
      isCustom: !!isCustom,
      ownerEmail: normalizedOwnerEmail.value,
    };

    if (isCustom) {
      createData.enabledTabs = JSON.parse(JSON.stringify([]));
      createData.customSchema = customSchema ? JSON.parse(JSON.stringify(customSchema)) : JSON.parse(JSON.stringify([]));
      createData.customData = JSON.parse(JSON.stringify({}));
    } else {
      createData.enabledTabs = enabledTabs ? JSON.parse(JSON.stringify(enabledTabs)) : null;
      createData.communicationChannels = communicationChannels ? JSON.parse(JSON.stringify(communicationChannels)) : null;
      createData.featureToggles = featureToggles ? JSON.parse(JSON.stringify(featureToggles)) : null;
      createData.companyInfo = JSON.parse(JSON.stringify(defaults.companyInfo));
      createData.users = JSON.parse(JSON.stringify(defaults.users));
      createData.campaigns = JSON.parse(JSON.stringify(defaults.campaigns));
      createData.sites = JSON.parse(JSON.stringify(defaults.sites));
      createData.prescreening = JSON.parse(JSON.stringify(defaults.prescreening));
      createData.messaging = JSON.parse(JSON.stringify(defaults.messaging));
      createData.sources = JSON.parse(JSON.stringify(defaults.sources));
      createData.folders = JSON.parse(JSON.stringify(defaults.folders));
      createData.documents = JSON.parse(JSON.stringify(defaults.documents));
      createData.attributes = JSON.parse(JSON.stringify(defaults.attributes));
      createData.fbWhatsapp = JSON.parse(JSON.stringify(defaults.fbWhatsapp));
      createData.instagram = JSON.parse(JSON.stringify(defaults.instagram));
      createData.aiCallFaqs = JSON.parse(JSON.stringify(defaults.aiCallFaqs));
      createData.agencyPortal = JSON.parse(JSON.stringify(defaults.agencyPortal));
      createData.labels = JSON.parse(JSON.stringify(defaults.labels));
      createData.adminSettings = JSON.parse(JSON.stringify(defaults.adminSettings));
      createData.atsIntegrations = JSON.parse(JSON.stringify(defaults.atsIntegrations));
      createData.integrations = JSON.parse(JSON.stringify(defaults.integrations));
      if (customTabs && Array.isArray(customTabs) && customTabs.length > 0) {
        createData.customTabs = JSON.parse(JSON.stringify(customTabs));
        createData.customData = JSON.parse(JSON.stringify({}));
      }
    }

    const checklist = await prisma.checklist.create({
      data: createData as Parameters<typeof prisma.checklist.create>[0]["data"],
    });

    return NextResponse.json(checklist, { status: 201 });
  } catch (err) {
    console.error("POST /api/checklists error:", err);
    return NextResponse.json({ error: "Failed to create checklist. Check database connection." }, { status: 500 });
  }
}
