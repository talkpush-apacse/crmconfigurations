import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { CONFIGURATOR_TEMPLATE } from '@/lib/configurator-template';
import { getApplicableItems, buildChannelArray } from '@/lib/configurator-filter';
import { syncConfiguratorState } from '@/lib/configurator-sync';
import type { ConfiguratorChecklistBlob } from '@/lib/configurator-template';
import type { CommunicationChannels, FeatureToggles } from '@/lib/types';

// POST — re-read source config, re-filter template, sync state (soft-archive removed items)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const checklist = await prisma.checklist.findUnique({
      where: { id },
      select: { enabledTabs: true, communicationChannels: true, featureToggles: true, configuratorChecklist: true, version: true },
    });
    if (!checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!checklist.configuratorChecklist) {
      return NextResponse.json({ error: 'Configurator not yet generated' }, { status: 422 });
    }

    const enabledTabs = (checklist.enabledTabs as string[] | null) ?? [];
    const channels = buildChannelArray(
      checklist.communicationChannels as CommunicationChannels | null,
      enabledTabs
    );
    const featureToggles = (checklist.featureToggles as FeatureToggles | null) ?? {};
    const applicable = getApplicableItems(CONFIGURATOR_TEMPLATE, {
      enabledTabs,
      communicationChannels: channels,
      featureToggles: featureToggles as Record<string, boolean>,
    });

    const now = new Date().toISOString();
    const existing = checklist.configuratorChecklist as unknown as ConfiguratorChecklistBlob;
    const refreshed = syncConfiguratorState(applicable, existing, now);

    const updated = await prisma.checklist.update({
      where: { id },
      data: {
        configuratorChecklist: JSON.parse(JSON.stringify(refreshed)),
        version: { increment: 1 },
      },
      select: { version: true },
    });

    return NextResponse.json({
      blob: refreshed,
      applicableItems: applicable,
      isStale: false,
      version: updated.version,
    });
  } catch (err) {
    console.error('POST /api/checklists/[id]/configurator/refresh error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
