import ExcelJS from "exceljs";
import type {
  ConfiguratorChecklistBlob,
  ConfiguratorItemState,
  ConfiguratorStatus,
  ConfiguratorTemplateItem,
} from "@/lib/configurator-template";
import { resolveContextPath } from "@/lib/configurator-filter";
import { getConfiguratorSourceContext } from "@/lib/configurator-source-context";
import { buildConfiguratorSummaryRows } from "@/lib/configurator-summary";

interface ConfiguratorExportInput {
  clientName: string;
  blob: ConfiguratorChecklistBlob;
  templateItems: ConfiguratorTemplateItem[];
  sourceData: unknown;
  updatedByLabels?: Record<string, string>;
}

const STATUS_LABELS: Record<ConfiguratorStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  in_progress_with_dependency: "In Progress w/ Dependency",
  blocked: "Blocked",
};

const STATUS_FILLS: Partial<Record<ConfiguratorStatus, string>> = {
  completed: "FFDCFCE7",
  in_progress: "FFDBEAFE",
  in_progress_with_dependency: "FFFEF3C7",
  blocked: "FFFEE2E2",
};

function formatStatus(status: ConfiguratorStatus | null): string {
  return status ? STATUS_LABELS[status] : "";
}

function updatedByLabel(updatedBy: string | null, labels?: Record<string, string>): string {
  if (!updatedBy) return "";
  if (updatedBy === "mcp") return "MCP";
  return labels?.[updatedBy] ?? updatedBy;
}

function setHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
  row.alignment = { vertical: "middle" };
}

function setWrap(row: ExcelJS.Row, columns: number[]) {
  for (const col of columns) {
    row.getCell(col).alignment = { wrapText: true, vertical: "top" };
  }
}

function contextForItem(item: ConfiguratorTemplateItem, sourceData: unknown): string {
  const staticLines = item.contextFields && item.contextFields.length > 0
    ? item.contextFields.map((field) => `${field.label}: ${resolveContextPath(sourceData, field.path)}`)
    : [];
  const sourceLines = getConfiguratorSourceContext(item.id, sourceData).flatMap((context) => [
    context.title,
    ...context.lines,
  ]);

  return [...staticLines, ...sourceLines].join("\n");
}

function safeFilenamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "client";
}

export function configuratorExportFilename(clientName: string, date = new Date()): string {
  const yyyyMmDd = date.toISOString().slice(0, 10);
  return `${safeFilenamePart(clientName)}-configurator-checklist-${yyyyMmDd}.xlsx`;
}

export async function generateConfiguratorExcel(input: ConfiguratorExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const templateMap = new Map(input.templateItems.map((item) => [item.id, item]));
  const stateMap = new Map(input.blob.items.map((item) => [item.itemId, item]));
  const activeStates = input.blob.snapshotItemIds
    .map((itemId) => stateMap.get(itemId))
    .filter((item): item is ConfiguratorItemState => !!item && !item.archived);
  const archivedStates = input.blob.items.filter((item) => item.archived);
  const summaryRows = buildConfiguratorSummaryRows(input.sourceData);

  const checklistSheet = workbook.addWorksheet("Configurator Checklist");
  checklistSheet.columns = [
    { header: "Step #", key: "step", width: 8 },
    { header: "Section", key: "section", width: 20 },
    { header: "Task", key: "task", width: 50 },
    { header: "Tip", key: "tip", width: 35 },
    { header: "Context", key: "context", width: 30 },
    { header: "Status", key: "status", width: 22 },
    { header: "Notes", key: "notes", width: 35 },
    { header: "Updated By", key: "updatedBy", width: 18 },
    { header: "Last Updated", key: "lastUpdated", width: 18 },
  ];
  checklistSheet.views = [{ state: "frozen", ySplit: 1 }];
  setHeaderStyle(checklistSheet.getRow(1));

  activeStates.forEach((state, index) => {
    const template = templateMap.get(state.itemId);
    const row = checklistSheet.addRow({
      step: index + 1,
      section: template?.section ?? "Unknown",
      task: template?.title ?? state.itemId,
      tip: template?.tip ?? "",
      context: template ? contextForItem(template, input.sourceData) : "",
      status: formatStatus(state.status),
      notes: state.notes ?? "",
      updatedBy: updatedByLabel(state.updatedBy, input.updatedByLabels),
      lastUpdated: state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "",
    });
    setWrap(row, [3, 4, 5, 7]);
    if (state.status && STATUS_FILLS[state.status]) {
      row.getCell(6).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: STATUS_FILLS[state.status] },
      };
    }
  });

  const summarySheet = workbook.addWorksheet("Summary");
  const total = input.blob.snapshotItemIds.length;
  const completed = activeStates.filter((item) => item.status === "completed").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 26 },
    { header: "Value", key: "value", width: 48 },
  ];
  setHeaderStyle(summarySheet.getRow(1));
  summarySheet.addRows([
    { metric: "Client name", value: input.clientName },
    { metric: "Generated at", value: new Date(input.blob.generatedAt).toLocaleString() },
    { metric: "Last snapshot at", value: new Date(input.blob.lastSnapshotAt).toLocaleString() },
    { metric: "Overall progress", value: `${completed} / ${total} completed — ${percent}%` },
  ]);
  summarySheet.addRow({});
  const sectionHeader = summarySheet.addRow(["Section", "Total / Completed / In Progress / Blocked"]);
  setHeaderStyle(sectionHeader);

  const sectionCounts: Record<string, { total: number; completed: number; inProgress: number; blocked: number }> = {};
  for (const state of activeStates) {
    const section = templateMap.get(state.itemId)?.section ?? "Unknown";
    sectionCounts[section] ??= { total: 0, completed: 0, inProgress: 0, blocked: 0 };
    sectionCounts[section].total += 1;
    if (state.status === "completed") sectionCounts[section].completed += 1;
    if (state.status === "in_progress" || state.status === "in_progress_with_dependency") {
      sectionCounts[section].inProgress += 1;
    }
    if (state.status === "blocked") sectionCounts[section].blocked += 1;
  }
  for (const [section, counts] of Object.entries(sectionCounts)) {
    summarySheet.addRow({
      metric: section,
      value: `${counts.total} / ${counts.completed} / ${counts.inProgress} / ${counts.blocked}`,
    });
  }

  if (summaryRows.length > 0) {
    const sourceSheet = workbook.addWorksheet("CRM Source Steps");
    sourceSheet.columns = [
      { header: "#", key: "index", width: 8 },
      { header: "Path", key: "path", width: 24 },
      { header: "Tester Perspective", key: "testerPerspective", width: 20 },
      { header: "Action", key: "action", width: 80 },
      { header: "Module", key: "module", width: 24 },
    ];
    sourceSheet.views = [{ state: "frozen", ySplit: 1 }];
    setHeaderStyle(sourceSheet.getRow(1));
    summaryRows.forEach((sourceRow, index) => {
      const row = sourceSheet.addRow({
        index: index + 1,
        path: sourceRow.path,
        testerPerspective: sourceRow.testerPerspective,
        action: sourceRow.action,
        module: sourceRow.module,
      });
      setWrap(row, [2, 4]);
    });
  }

  if (archivedStates.length > 0) {
    const archivedSheet = workbook.addWorksheet("Archived");
    archivedSheet.columns = [
      { header: "Section", key: "section", width: 20 },
      { header: "Task", key: "task", width: 50 },
      { header: "Last Status", key: "status", width: 22 },
      { header: "Notes", key: "notes", width: 35 },
      { header: "Updated By", key: "updatedBy", width: 18 },
      { header: "Last Updated", key: "lastUpdated", width: 18 },
      { header: "Archived Reason", key: "reason", width: 28 },
    ];
    archivedSheet.views = [{ state: "frozen", ySplit: 1 }];
    setHeaderStyle(archivedSheet.getRow(1));

    for (const state of archivedStates) {
      const template = templateMap.get(state.itemId);
      const row = archivedSheet.addRow({
        section: template?.section ?? "Unknown",
        task: template?.title ?? state.itemId,
        status: formatStatus(state.status),
        notes: state.notes ?? "",
        updatedBy: updatedByLabel(state.updatedBy, input.updatedByLabels),
        lastUpdated: state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "",
        reason: "no longer in current scope",
      });
      setWrap(row, [2, 4, 7]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
