import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checklist = await prisma.checklist.findUnique({ where: { id } });
  if (!checklist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(checklist);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const {
    companyInfo,
    users,
    campaigns,
    sites,
    prescreening,
    messaging,
    sources,
    folders,
    documents,
    fbWhatsapp,
    instagram,
    aiCallFaqs,
    agencyPortal,
  } = body;

  const checklist = await prisma.checklist.update({
    where: { id },
    data: {
      companyInfo,
      users,
      campaigns,
      sites,
      prescreening,
      messaging,
      sources,
      folders,
      documents,
      fbWhatsapp,
      instagram,
      aiCallFaqs,
      agencyPortal,
    },
  });

  return NextResponse.json(checklist);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.checklist.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
