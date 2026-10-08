import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { buildExportResponse } from "@/lib/export-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { slug } = await params;

    // Note: this app uses a shared admin pool — all authenticated admins have access
    // to all checklists. If per-user ownership is added in future, scope this query
    // with: where: { slug, createdBy: auth.userId } after adding a createdBy column.
    const checklist = await prisma.checklist.findUnique({
      where: { slug },
    // No `select`: the export reads eighteen different fields, and hand-listing
    // them meant anything added to the workbook was silently dropped here.
    // Custom tab sheets, Attributes, Autoflows, Integrations and Tab Uploads
    // were all missing from every export for exactly this reason.
    });
    if (!checklist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // await: so a failure is caught below and answered, not thrown past this handler
    return await buildExportResponse(checklist, request.nextUrl.searchParams.get("tab"), "staff");
  } catch (err) {
    console.error("GET /api/export/[slug] error:", err);
    return NextResponse.json({ error: "Failed to export checklist. Check database connection." }, { status: 500 });
  }
}
