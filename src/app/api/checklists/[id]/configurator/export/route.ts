import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { CONFIGURATOR_TEMPLATE } from '@/lib/configurator-template';
import { generateConfiguratorExcel, configuratorExportFilename } from '@/lib/configurator-export';
import type { ConfiguratorChecklistBlob } from '@/lib/configurator-template';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({
      where: { id },
      select: {
        clientName: true,
        configuratorChecklist: true,
        companyInfo: true,
        enabledTabs: true,
        communicationChannels: true,
        featureToggles: true,
      },
    });
    if (!checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!checklist.configuratorChecklist) {
      return NextResponse.json({ error: 'Configurator not yet generated' }, { status: 422 });
    }

    const blob = checklist.configuratorChecklist as unknown as ConfiguratorChecklistBlob;
    const checklistData = checklist as Record<string, unknown>;
    const filename = configuratorExportFilename(checklist.clientName);

    const buffer = await generateConfiguratorExcel(
      blob,
      CONFIGURATOR_TEMPLATE,
      checklistData,
      checklist.clientName
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/checklists/[id]/configurator/export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
