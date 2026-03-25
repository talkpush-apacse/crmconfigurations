import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const assignments = await prisma.checklistAssignment.findMany({
      where: { userId: id },
      include: {
        checklist: {
          select: { id: true, slug: true, clientName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      items: assignments.map((a) => ({
        id: a.id,
        checklistId: a.checklist.id,
        slug: a.checklist.slug,
        clientName: a.checklist.clientName,
        assignedAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/users/[id]/assignments error:", err);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { checklistIds } = await request.json();

    if (!Array.isArray(checklistIds) || checklistIds.length === 0) {
      return NextResponse.json({ error: "checklistIds array is required" }, { status: 400 });
    }

    await prisma.checklistAssignment.createMany({
      data: checklistIds.map((checklistId: string) => ({
        userId: id,
        checklistId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, count: checklistIds.length });
  } catch (err) {
    console.error("POST /api/users/[id]/assignments error:", err);
    return NextResponse.json({ error: "Failed to assign checklists" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { checklistIds } = await request.json();

    if (!Array.isArray(checklistIds) || checklistIds.length === 0) {
      return NextResponse.json({ error: "checklistIds array is required" }, { status: 400 });
    }

    await prisma.checklistAssignment.deleteMany({
      where: {
        userId: id,
        checklistId: { in: checklistIds },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/users/[id]/assignments error:", err);
    return NextResponse.json({ error: "Failed to remove assignments" }, { status: 500 });
  }
}
