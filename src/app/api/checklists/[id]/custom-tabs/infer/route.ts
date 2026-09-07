import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { buildProposal, type SpreadsheetProposal } from "@/lib/spreadsheet-infer";
import { readSpreadsheet } from "@/lib/spreadsheet-read";

/**
 * Reads an uploaded CSV/XLSX and returns a *proposed* custom-tab schema.
 *
 * This endpoint deliberately writes nothing. Type detection is a guess even at
 * its best, so the proposal goes back to the admin for review and only the
 * subsequent checklist save creates the tab.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Confirm the checklist exists before doing any parsing work.
    const checklist = await prisma.checklist.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const requestedSheet = (formData.get("sheet") as string) || undefined;

    const read = await readSpreadsheet(file, requestedSheet);
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status });
    }

    const proposal: SpreadsheetProposal = buildProposal(read.grid);

    if (proposal.columns.length === 0) {
      return NextResponse.json(
        {
          error:
            proposal.warnings[0] ??
            "No column headers found. The first row of the sheet should hold the column names.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(proposal);
  } catch (err) {
    console.error("POST /api/checklists/[id]/custom-tabs/infer error:", err);
    return NextResponse.json({ error: "Could not process the file" }, { status: 500 });
  }
}
