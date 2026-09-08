import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { buildProposal, type SpreadsheetProposal } from "@/lib/spreadsheet-infer";
import { readAllSheets } from "@/lib/spreadsheet-read";

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

    // Every worksheet is analyzed, not just the first: a client's workbook
    // usually holds several related lists on separate sheets, and importing
    // only one silently dropped the rest.
    const read = await readAllSheets(file);
    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: read.status });
    }

    const skipped = [...read.skipped];
    const sheets: SpreadsheetProposal[] = [];

    for (const grid of read.grids) {
      const proposal = buildProposal(grid);
      if (proposal.columns.length === 0) {
        skipped.push({
          name: grid.sheetName,
          reason: "no column headers in the first row",
        });
        continue;
      }
      sheets.push(proposal);
    }

    if (sheets.length === 0) {
      return NextResponse.json(
        {
          error:
            "No worksheet had usable column headers. The first row of each sheet should hold the column names.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ sheets, skipped });
  } catch (err) {
    console.error("POST /api/checklists/[id]/custom-tabs/infer error:", err);
    return NextResponse.json({ error: "Could not process the file" }, { status: 500 });
  }
}
