import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import { CONFIGURATOR_TEMPLATE } from '@/lib/configurator-template';
import { getApplicableItems, buildChannelArray } from '@/lib/configurator-filter';
import { syncConfiguratorState } from '@/lib/configurator-sync';
import type { ConfiguratorChecklistBlob, ConfiguratorItemState } from '@/lib/configurator-template';
import type { CommunicationChannels, FeatureToggles } from '@/lib/types';

const patchSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(['completed', 'in_progress', 'in_progress_with_dependency', 'blocked']).nullable(),
  notes: z.string().nullable(),
  version: z.number().int(),
});

function buildApplicableItems(checklist: {
  enabledTabs: unknown;
  communicationChannels: unknown;
  featureToggles: unknown;
}) {
  const enabledTabs = (checklist.enabledTabs as string[] | null) ?? [];
  const channels = buildChannelArray(
    checklist.communicationChannels as CommunicationChannels | null,
    enabledTabs
  );
  const featureToggles = (checklist.featureToggles as FeatureToggles | null) ?? {};
  return getApplicableItems(CONFIGURATOR_TEMPLATE, {
    enabledTabs,
    communicationChannels: channels,
    featureToggles: featureToggles as Record<string, boolean>,
  });
}

function isStaleSnapshot(blob: ConfiguratorChecklistBlob, currentApplicableIds: string[]): boolean {
  const snapshotSet = new Set(blob.snapshotItemIds);
  const currentSet = new Set(currentApplicableIds);
  if (snapshotSet.size !== currentSet.size) return true;
  for (const id of snapshotSet) {
    if (!currentSet.has(id)) return true;
  }
  return false;
}

// GET — return current blob + applicable items + staleness flag
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
      select: { enabledTabs: true, communicationChannels: true, featureToggles: true, configuratorChecklist: true, version: true },
    });
    if (!checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const applicable = buildApplicableItems(checklist);
    const blob = checklist.configuratorChecklist as unknown as ConfiguratorChecklistBlob | null;
    const stale = blob ? isStaleSnapshot(blob, applicable.map(i => i.id)) : false;

    return NextResponse.json({
      blob,
      applicableItems: applicable,
      isStale: stale,
      version: checklist.version,
    });
  } catch (err) {
    console.error('GET /api/checklists/[id]/configurator error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST — generate blob (idempotent: returns existing blob unchanged if already generated)
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

    const applicable = buildApplicableItems(checklist);
    const existingBlob = checklist.configuratorChecklist as unknown as ConfiguratorChecklistBlob | null;

    // Idempotent: if blob already exists, return it
    if (existingBlob) {
      const stale = isStaleSnapshot(existingBlob, applicable.map(i => i.id));
      return NextResponse.json({
        blob: existingBlob,
        applicableItems: applicable,
        isStale: stale,
        version: checklist.version,
      });
    }

    // Generate new blob
    const now = new Date().toISOString();
    const blob = syncConfiguratorState(applicable, null, now);

    const updated = await prisma.checklist.update({
      where: { id },
      data: {
        configuratorChecklist: JSON.parse(JSON.stringify(blob)),
        version: { increment: 1 },
      },
      select: { version: true },
    });

    return NextResponse.json({
      blob,
      applicableItems: applicable,
      isStale: false,
      version: updated.version,
    });
  } catch (err) {
    console.error('POST /api/checklists/[id]/configurator error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH — update a single item's status and/or notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { id } = await params;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { itemId, status, notes, version: clientVersion } = parsed.data;

    // Look up the admin user's email for the updatedBy field
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const updatedBy = adminUser?.email ?? userId;

    // Optimistic lock + update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string;
        version: number;
        configuratorChecklist: ConfiguratorChecklistBlob | null;
      }>>`SELECT id, version, "configuratorChecklist" FROM "Checklist" WHERE id = ${id} FOR UPDATE`;

      const row = rows[0];
      if (!row) return { status: 404 as const };

      if (row.version !== clientVersion) {
        return {
          status: 409 as const,
          currentVersion: row.version,
          blob: row.configuratorChecklist,
        };
      }

      const blob = row.configuratorChecklist as unknown as ConfiguratorChecklistBlob | null;
      if (!blob) return { status: 422 as const, error: 'Configurator not generated yet' };

      const itemIndex = blob.items.findIndex(i => i.itemId === itemId);
      if (itemIndex === -1) return { status: 404 as const, error: 'Item not found' };

      const item = blob.items[itemIndex];
      if (item.archived) return { status: 422 as const, error: 'Cannot update archived item' };

      const now = new Date().toISOString();
      const updatedItem: ConfiguratorItemState = {
        ...item,
        status,
        notes,
        updatedAt: now,
        updatedBy,
      };

      const updatedItems = [...blob.items];
      updatedItems[itemIndex] = updatedItem;
      const updatedBlob: ConfiguratorChecklistBlob = { ...blob, items: updatedItems };

      const newVersion = row.version + 1;
      await tx.checklist.update({
        where: { id },
        data: {
          configuratorChecklist: JSON.parse(JSON.stringify(updatedBlob)),
          version: newVersion,
        },
      });

      return { status: 200 as const, item: updatedItem, version: newVersion };
    });

    if (result.status === 404) {
      return NextResponse.json({ error: result.error ?? 'Not found' }, { status: 404 });
    }
    if (result.status === 409) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: result.currentVersion, blob: result.blob },
        { status: 409 }
      );
    }
    if (result.status === 422) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ item: result.item, version: result.version });
  } catch (err) {
    console.error('PATCH /api/checklists/[id]/configurator error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
