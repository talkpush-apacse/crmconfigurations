import ExcelJS from 'exceljs';
import type { ConfiguratorChecklistBlob, ConfiguratorTemplateItem, ConfiguratorStatus } from '@/lib/configurator-template';
import { resolveContextPath } from '@/lib/configurator-filter';

const STATUS_LABELS: Record<ConfiguratorStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  in_progress_with_dependency: 'In Progress w/ Dependency',
  blocked: 'Blocked',
};

const STATUS_FILLS: Record<ConfiguratorStatus, ExcelJS.Fill> = {
  completed: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
  in_progress: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
  in_progress_with_dependency: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
  blocked: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function generateConfiguratorExcel(
  blob: ConfiguratorChecklistBlob,
  template: ConfiguratorTemplateItem[],
  checklistData: Record<string, unknown>,
  clientName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dateStr = new Date().toISOString().slice(0, 10);

  // Build lookup maps
  const templateMap = new Map(template.map(t => [t.id, t]));
  const stateMap = new Map(blob.items.map(s => [s.itemId, s]));
  const snapshotSet = new Set(blob.snapshotItemIds);

  const activeItems = blob.snapshotItemIds
    .map(id => ({ template: templateMap.get(id), state: stateMap.get(id) }))
    .filter((x): x is { template: ConfiguratorTemplateItem; state: typeof blob.items[number] } =>
      !!x.template && !!x.state && !x.state.archived
    );

  // ── Sheet 1: Configurator Checklist ──────────────────────────────────────
  const sheet1 = workbook.addWorksheet('Configurator Checklist');

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

  sheet1.columns = [
    { key: 'step',      width: 8 },
    { key: 'section',   width: 20 },
    { key: 'task',      width: 50 },
    { key: 'tip',       width: 35 },
    { key: 'context',   width: 30 },
    { key: 'status',    width: 22 },
    { key: 'notes',     width: 35 },
    { key: 'updatedBy', width: 18 },
    { key: 'lastUpdated', width: 18 },
  ];

  const headers = ['Step #', 'Section', 'Task', 'Tip', 'Context', 'Status', 'Notes', 'Updated By', 'Last Updated'];
  const headerRow = sheet1.addRow(headers);
  headerRow.eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet1.views = [{ state: 'frozen', ySplit: 1 }];

  activeItems.forEach(({ template: tmpl, state }, idx) => {
    const contextLines = tmpl.contextFields
      ?.map(cf => `${cf.label}: ${resolveContextPath(checklistData, cf.path)}`)
      .join('\n') ?? '';

    const statusLabel = state.status ? STATUS_LABELS[state.status] : '';

    const row = sheet1.addRow([
      idx + 1,
      tmpl.section,
      tmpl.title,
      tmpl.tip ?? '',
      contextLines,
      statusLabel,
      state.notes ?? '',
      state.updatedBy ?? '',
      formatDate(state.updatedAt),
    ]);

    row.getCell('task').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('tip').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('context').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('notes').alignment = { wrapText: true, vertical: 'top' };

    if (state.status) {
      row.getCell('status').fill = STATUS_FILLS[state.status];
    }
  });

  // ── Sheet 2: Summary ─────────────────────────────────────────────────────
  const sheet2 = workbook.addWorksheet('Summary');
  const completedCount = blob.items.filter(
    s => snapshotSet.has(s.itemId) && !s.archived && s.status === 'completed'
  ).length;
  const totalCount = blob.snapshotItemIds.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  sheet2.addRow(['Client', clientName]);
  sheet2.addRow(['Generated at', formatDate(blob.generatedAt)]);
  sheet2.addRow(['Last refreshed', formatDate(blob.lastSnapshotAt)]);
  sheet2.addRow(['Overall progress', `${completedCount} / ${totalCount} completed — ${pct}%`]);
  sheet2.addRow([]);

  const sectionHeaderRow = sheet2.addRow(['Section', 'Total', 'Completed', 'In Progress', 'Blocked']);
  sectionHeaderRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  });

  // Group active items by section
  const sectionMap = new Map<string, typeof activeItems>();
  for (const entry of activeItems) {
    const s = entry.template.section;
    if (!sectionMap.has(s)) sectionMap.set(s, []);
    sectionMap.get(s)!.push(entry);
  }

  for (const [section, entries] of sectionMap) {
    const total = entries.length;
    const comp = entries.filter(e => e.state.status === 'completed').length;
    const inProg = entries.filter(e => e.state.status === 'in_progress' || e.state.status === 'in_progress_with_dependency').length;
    const blocked = entries.filter(e => e.state.status === 'blocked').length;
    sheet2.addRow([section, total, comp, inProg, blocked]);
  }

  sheet2.getColumn(1).width = 30;
  sheet2.getColumn(2).width = 10;
  sheet2.getColumn(3).width = 12;
  sheet2.getColumn(4).width = 14;
  sheet2.getColumn(5).width = 12;

  // ── Sheet 3: Archived (only if any exist) ────────────────────────────────
  const archivedItems = blob.items.filter(s => s.archived);
  if (archivedItems.length > 0) {
    const sheet3 = workbook.addWorksheet('Archived');
    sheet3.columns = [
      { key: 'section',       width: 25 },
      { key: 'task',          width: 50 },
      { key: 'lastStatus',    width: 22 },
      { key: 'notes',         width: 35 },
      { key: 'updatedBy',     width: 18 },
      { key: 'lastUpdated',   width: 18 },
      { key: 'archivedReason', width: 30 },
    ];

    const ah = sheet3.addRow(['Section', 'Task', 'Last Status', 'Notes', 'Updated By', 'Last Updated', 'Archived Reason']);
    ah.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } };
    });

    for (const state of archivedItems) {
      const tmpl = templateMap.get(state.itemId);
      sheet3.addRow([
        tmpl?.section ?? '',
        tmpl?.title ?? state.itemId,
        state.status ? STATUS_LABELS[state.status] : '',
        state.notes ?? '',
        state.updatedBy ?? '',
        formatDate(state.updatedAt),
        'No longer in current scope',
      ]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function configuratorExportFilename(clientName: string): string {
  const safe = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-configurator-checklist-${date}.xlsx`;
}
