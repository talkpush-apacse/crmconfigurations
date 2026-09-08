"use client";

import { useState, Fragment, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { Plus, Trash2, Copy, X, ChevronRight, ChevronDown, GripVertical, AlertTriangle, ClipboardCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditableCell } from "./EditableCell";
import { GridNavProvider } from "./grid-nav";
import { CsvToolbar } from "./CsvToolbar";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { BulkActionBar } from "./BulkActionBar";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { cn } from "@/lib/utils";
import { arrayMove } from "@/lib/utils";
import { useChecklistContext } from "@/lib/checklist-context";
import type { ColumnDef } from "@/lib/types";

type EditableRow = { id?: string };

interface EditableTableProps<TRow extends EditableRow> {
  columns: ColumnDef[];
  detailColumns?: ColumnDef[];
  data: TRow[];
  onUpdate: (index: number, field: string, value: string | boolean) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate?: (index: number) => void;
  /** Called with the reordered array when a row is dragged to a new position */
  onReorder?: (reorderedData: TRow[]) => void;
  addLabel?: string;
  hideAddButton?: boolean;
  emptyMessage?: React.ReactNode;
  renderCellPrefix?: (args: { row: EditableRow; column: ColumnDef; value: string | boolean | null | undefined }) => React.ReactNode;
  renderCell?: (args: {
    row: TRow;
    rowIdx: number;
    column: ColumnDef;
    value: string | boolean | null | undefined;
    onChange: (value: string | boolean) => void;
  }) => React.ReactNode;
  renderDetail?: (args: { row: TRow; rowIdx: number }) => React.ReactNode;
  deleteConfirmation?: {
    title?: string;
    getName?: (row: TRow) => string;
    getDescription?: (row: TRow) => React.ReactNode;
  };
  /** Optional pinned sample row shown at the top of the table body (read-only) */
  sampleRow?: Record<string, string>;
  /**
   * Opts this table into spreadsheet behaviour: pinned header, frozen leading
   * columns, detail panels closed by default with a filled/total badge, live
   * inputs, keyboard grid navigation and paste-from-Excel.
   *
   * Off by default — only the tabs that are genuinely spreadsheet-shaped want
   * it, and the rest keep the original form-style layout.
   */
  spreadsheetMode?: boolean;
  /**
   * Stable identifier for this table, used to remember column widths.
   *
   * Widths are kept per viewer in localStorage rather than on the checklist:
   * storing them server-side would need a new column, and one person's drag
   * would silently change the layout for everyone else. Omit it and resizing
   * still works, it just isn't remembered.
   */
  tableId?: string;
  /**
   * Enables pasting a block copied from Excel/Sheets across cells.
   *
   * A multi-cell paste has to be applied as ONE update: calling the per-cell
   * `onUpdate` in a loop would have every call read the same stale array and
   * only the last write would survive. So the table computes the whole next
   * array and hands it over in a single call.
   *
   * `createRow` is used when the pasted block is taller than the table.
   */
  pasteConfig?: {
    onApply: (nextRows: TRow[]) => void;
    createRow: () => TRow;
    /** Cap on rows a single paste may add. Defaults to 200. */
    maxNewRows?: number;
  };
  csvConfig?: {
    sampleRow: Record<string, string>;
    onImport: (rows: Record<string, string>[]) => void;
    sheetName: string;
    exportRows?: Record<string, string>[];
    extraExport?: {
      label: string;
      onClick: () => void;
      title?: string;
    };
  };
  /**
   * Enables the bulk-select column + bulk action bar.
   * Pass id-based handlers (NOT index-based — indexes drift after filtering).
   */
  bulkActions?: {
    /** Singular noun, e.g. "user" */
    itemLabel: string;
    /** Plural noun, e.g. "users" */
    itemLabelPlural: string;
    /** Soft-delete by id. Selection is cleared after this resolves. */
    onBulkDelete: (ids: string[]) => void | Promise<void>;
    /** Optional bulk duplicate by id. Selection is cleared after this resolves. */
    onBulkDuplicate?: (ids: string[]) => void | Promise<void>;
    /** Body shown in the bulk delete confirm dialog. */
    deleteDialogDescription?: (count: number) => React.ReactNode;
  };
}

/**
 * Default width per column type, in px.
 *
 * Without these the table runs on the browser's `auto` layout, where widths
 * follow content: one column holding a paragraph claims a huge share and
 * starves the rest. A required "Job Name" ended up ~60px wide — too narrow to
 * read its own value — while a job description spanned over 1000px.
 *
 * Spreadsheet mode therefore uses a fixed layout with these widths, so the
 * grid is predictable and long text is capped rather than unbounded.
 */
function defaultColumnWidth(col: ColumnDef): number {
  switch (col.type) {
    case "textarea":
      return 300;
    case "boolean":
      return 90;
    case "dropdown":
      return 170;
    case "multiselect":
      return 200;
    case "readonly":
      return 150;
    default:
      return 190;
  }
}

/** Resizing is clamped so a column can't be dragged to unusable extremes. */
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 720;

/**
 * Shapes a value pasted from a spreadsheet for the column it lands in, so a
 * pasted "Yes" becomes a ticked checkbox and a pasted choice matches the
 * dropdown option regardless of how it was capitalised.
 */
function coercePastedValue(raw: string, column: ColumnDef): string | boolean {
  const text = raw.trim();

  if (column.type === "boolean") {
    const v = text.toLowerCase();
    return v === "yes" || v === "y" || v === "true" || v === "1" || v === "x" || v === "\u2713";
  }

  if (column.type === "dropdown" && column.options?.length) {
    const match = column.options.find((o) => o.toLowerCase() === text.toLowerCase());
    return match ?? text;
  }

  if (column.type === "multiselect" && column.options?.length) {
    if (!text) return "";
    const delimiter = [";", "|", ","].find((d) => text.includes(d)) ?? ",";
    const tokens = text.split(delimiter).map((t) => t.trim()).filter(Boolean);
    const canonical = tokens.map(
      (token) =>
        column.options?.find((o) => o.toLowerCase() === token.toLowerCase()) ?? token
    );
    return Array.from(new Set(canonical)).join(", ");
  }

  return text;
}

/** How many of a row's detail fields carry a value — shown as a badge. */
function countFilledDetails(
  row: Record<string, unknown>,
  detailColumns: ColumnDef[]
): number {
  return detailColumns.filter((col) => hasCellValue(row[col.key])).length;
}

function hasCellValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  return value !== "" && value !== null && value !== undefined;
}

function renderColumnLabel(
  col: ColumnDef,
  markerClassName: string
): React.ReactNode {
  return (
    <>
      {col.label}
      {col.required && <span className={cn("ml-1", markerClassName)}>*</span>}
    </>
  );
}

interface BulkRowContext {
  enabled: boolean;
  isSelected: boolean;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function SortableRow<TRow extends EditableRow>({
  row,
  rowIdx,
  columns,
  detailColumns,
  isExpanded,
  toggleRow,
  onUpdate,
  onDuplicate,
  confirmingDeleteId,
  handleDeleteClick,
  clearConfirmingDelete,
  isReadOnly,
  canReorder,
  rowIsActive,
  renderCellPrefix,
  renderCell,
  renderDetail,
  requestDelete,
  bulkRow,
  numColLeft,
  firstDataColLeft,
  stickyColumns,
  detailFilledCount,
}: {
  row: TRow;
  rowIdx: number;
  columns: ColumnDef[];
  detailColumns?: ColumnDef[];
  isExpanded: boolean;
  toggleRow: () => void;
  onUpdate: (index: number, field: string, value: string | boolean) => void;
  onDuplicate?: (index: number) => void;
  confirmingDeleteId: string | null;
  handleDeleteClick: (rowId: string, rowIdx: number) => void;
  clearConfirmingDelete: () => void;
  isReadOnly: boolean;
  canReorder: boolean;
  rowIsActive: boolean;
  renderCellPrefix?: (args: { row: EditableRow; column: ColumnDef; value: string | boolean | null | undefined }) => React.ReactNode;
  renderCell?: (args: {
    row: TRow;
    rowIdx: number;
    column: ColumnDef;
    value: string | boolean | null | undefined;
    onChange: (value: string | boolean) => void;
  }) => React.ReactNode;
  renderDetail?: (args: { row: TRow; rowIdx: number }) => React.ReactNode;
  requestDelete?: (rowIdx: number) => void;
  bulkRow?: BulkRowContext;
  /** Left offsets, in px, for the frozen leading columns. */
  numColLeft: number;
  firstDataColLeft: number;
  /** Whether the leading columns are frozen (spreadsheet mode only). */
  stickyColumns: boolean;
  /** Filled / total detail fields, for the collapsed-row badge. */
  detailFilledCount?: { filled: number; total: number };
}) {
  const rowValues = row as Record<string, string | boolean | null | undefined>;
  const sortableId = row.id || `row-${rowIdx}`;
  const isConfirmingDelete = confirmingDeleteId === sortableId;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId, disabled: isReadOnly || !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Fragment>
      <TableRow
        ref={setNodeRef}
        style={style}
        className={cn(
          "transition-colors hover:bg-gray-50",
          // Frozen columns inherit the row background, and a translucent one
          // would let scrolled cells show through — so spreadsheet mode needs
          // it fully opaque. Other tabs keep the original softer shade.
          rowIdx % 2 === 0
            ? "bg-white"
            : stickyColumns
              ? "bg-slate-50"
              : "bg-slate-50/60",
          (detailColumns || renderDetail) && !isExpanded && "border-b border-gray-200",
          isDragging && "bg-brand-lavender-lightest shadow-sm",
          bulkRow?.isSelected && "bg-brand-sage-lightest hover:bg-brand-sage-lightest"
        )}
      >
        {bulkRow?.enabled && (
          <TableCell
            className={cn(
              "w-10 text-center",
              stickyColumns && "sticky left-0 z-10 bg-inherit"
            )}
          >
            <Checkbox
              checked={bulkRow.isSelected}
              onClick={bulkRow.onToggle}
              onCheckedChange={() => {}}
              aria-label={`Select row ${rowIdx + 1}`}
            />
          </TableCell>
        )}
        <TableCell
          className={cn(
            "text-center text-xs text-muted-foreground",
            stickyColumns && "sticky z-10 bg-inherit"
          )}
          style={stickyColumns ? { left: numColLeft } : undefined}
        >
          <div className="flex items-center justify-center gap-0.5">
            {canReorder && !isReadOnly && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200 transition-colors touch-none"
                title="Drag to reorder"
              >
                <GripVertical className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
            {detailColumns || renderDetail ? (
              <button
                onClick={toggleRow}
                className="inline-flex flex-col items-center rounded px-1 py-0.5 hover:bg-gray-100 hover:text-primary transition-colors"
                title={isExpanded ? "Collapse details" : "Expand details"}
              >
                <span className="inline-flex items-center gap-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span>{rowIdx + 1}</span>
                </span>
                {/*
                  Collapsed rows would otherwise hide their own emptiness. In
                  spreadsheet mode nothing is hidden, so isExpandable is false
                  and this never renders.
                */}
                {!isExpanded && detailFilledCount && detailFilledCount.total > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 rounded px-1 text-[9px] font-semibold leading-tight",
                      detailFilledCount.filled === 0
                        ? "bg-gray-100 text-gray-500"
                        : detailFilledCount.filled === detailFilledCount.total
                          ? "bg-brand-sage-lightest text-green-700"
                          : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {detailFilledCount.filled}/{detailFilledCount.total}
                  </span>
                )}
              </button>
            ) : (
              rowIdx + 1
            )}
          </div>
        </TableCell>
        {columns.map((col, colIdx) => (
          <TableCell
            key={col.key}
            className={cn(
              "p-1.5",
              // In spreadsheet mode the header row's declared widths govern the
              // fixed layout, so per-cell minimums would only fight them.
              !stickyColumns &&
                (col.type === "textarea"
                  ? "min-w-[180px]"
                  : col.type === "text"
                    ? "min-w-[120px]"
                    : ""),
              stickyColumns && colIdx === 0 && "sticky z-10 bg-inherit"
            )}
            style={
              stickyColumns && colIdx === 0
                ? { left: firstDataColLeft }
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              {renderCellPrefix?.({ row, column: col, value: rowValues[col.key] })}
              <div className="min-w-0 flex-1">
                {renderCell ? (
                  renderCell({
                    row,
                    rowIdx,
                    column: col,
                    value: rowValues[col.key],
                    onChange: (val) => onUpdate(rowIdx, col.key, val),
                  })
                ) : (
                  <EditableCell
                    value={rowValues[col.key] as string | boolean}
                    type={col.type}
                    options={col.options}
                    onChange={(val) => onUpdate(rowIdx, col.key, val)}
                    placeholder={col.label}
                    validation={col.validation}
                    required={col.required}
                    showRequiredError={rowIsActive}
                    gridRow={rowIdx}
                    gridCol={colIdx}
                  />
                )}
              </div>
            </div>
          </TableCell>
        ))}
        {!isReadOnly && (
          <TableCell className="p-1.5">
            <div className="flex items-center gap-0.5">
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-gray-100"
                  onClick={() => onDuplicate(rowIdx)}
                  title="Duplicate row"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {isConfirmingDelete ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => handleDeleteClick(sortableId, rowIdx)}
                    title="Confirm delete"
                  >
                    Delete?
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-gray-100"
                    onClick={clearConfirmingDelete}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50"
                  onClick={() => requestDelete ? requestDelete(rowIdx) : handleDeleteClick(sortableId, rowIdx)}
                  title="Delete row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
      {(detailColumns || renderDetail) && isExpanded && (
        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
          <TableCell colSpan={columns.length + 2 + (bulkRow?.enabled ? 1 : 0)} className="p-0">
            <div className="px-6 py-4 ml-8 border-l-2 border-primary/20 bg-gray-50 rounded-sm">
              {renderDetail ? (
                renderDetail({ row, rowIdx })
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {detailColumns?.map((col) => {
                  const isWide = col.type === "textarea";
                  return (
                    <div
                      key={col.key}
                      className={isWide ? "col-span-2" : "col-span-1"}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="inline-flex items-center gap-1">
                          {renderColumnLabel(col, "text-red-500")}
                          {col.description && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex shrink-0 cursor-help items-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                                  aria-label={`About ${col.label}`}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <div className="space-y-1 text-xs leading-relaxed">
                                  {col.description}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </label>
                      <EditableCell
                        value={rowValues[col.key] as string | boolean}
                        type={col.type}
                        options={col.options}
                        onChange={(val) => onUpdate(rowIdx, col.key, val)}
                        placeholder={col.label}
                        validation={col.validation}
                        required={col.required}
                        showRequiredError={rowIsActive}
                      />
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export function EditableTable<TRow extends EditableRow>({
  columns,
  detailColumns,
  data,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
  onReorder,
  addLabel = "Add Row",
  hideAddButton = false,
  emptyMessage,
  renderCellPrefix,
  renderCell,
  renderDetail,
  deleteConfirmation,
  sampleRow,
  spreadsheetMode = false,
  tableId,
  pasteConfig,
  csvConfig,
  bulkActions,
}: EditableTableProps<TRow>) {
  const { isReadOnly } = useChecklistContext();
  // Track confirm by stable row ID (not index) so drag-reorder doesn't target the wrong row
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Rows whose open/closed state differs from the mode's default. Tracking the
  // difference rather than the state itself keeps both defaults correct without
  // having to re-seed the set when the data changes.
  //
  // Spreadsheet mode defaults to CLOSED: expanded-by-default made one row
  // ~400px tall, so two rows could never be compared side by side. Other tabs
  // keep their original expanded-by-default behaviour.
  const [toggledRowIds, setToggledRowIds] = useState<Set<string>>(
    () => new Set()
  );
  const isRowExpanded = (rowId: string) =>
    spreadsheetMode ? toggledRowIds.has(rowId) : !toggledRowIds.has(rowId);
  const [deleteDialogIndex, setDeleteDialogIndex] = useState<number | null>(null);
  // Transient confirmation after a multi-cell paste, so a paste that was
  // capped or partly out of range doesn't fail silently.
  const [pasteNotice, setPasteNotice] = useState<{
    text: string;
    tone: "ok" | "warn";
  } | null>(null);
  const pasteNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPasteNotice = useCallback((text: string, tone: "ok" | "warn") => {
    setPasteNotice({ text, tone });
    if (pasteNoticeTimer.current) clearTimeout(pasteNoticeTimer.current);
    pasteNoticeTimer.current = setTimeout(() => setPasteNotice(null), 5000);
  }, []);

  useEffect(
    () => () => {
      if (pasteNoticeTimer.current) clearTimeout(pasteNoticeTimer.current);
    },
    []
  );

  // ===== Bulk selection =====
  const bulkSelection = useBulkSelection();
  const bulkEnabled = !!bulkActions && !isReadOnly;
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Stable IDs for sortable context
  const sortableIds = useMemo(
    () => data.map((row, i) => row.id || `row-${i}`),
    [data]
  );

  // Only string ids (with a real `row.id`) participate in bulk select
  const selectableIds = useMemo(
    () => data.map((r) => r.id).filter((id): id is string => typeof id === "string" && id.length > 0),
    [data]
  );

  const headerChecked = bulkEnabled && bulkSelection.allSelected(selectableIds);
  const headerIndeterminate = bulkEnabled && bulkSelection.someSelected(selectableIds);

  const runBulkDelete = async () => {
    if (!bulkActions) return;
    const ids = Array.from(bulkSelection.selectedIds);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    setBulkBusy(true);
    try {
      await bulkActions.onBulkDelete(ids);
      bulkSelection.clear();
    } finally {
      setBulkBusy(false);
      setBulkDeleteOpen(false);
    }
  };

  const runBulkDuplicate = async () => {
    if (!bulkActions?.onBulkDuplicate) return;
    const ids = Array.from(bulkSelection.selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkActions.onBulkDuplicate(ids);
      bulkSelection.clear();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkLabel = bulkActions
    ? bulkSelection.count === 1
      ? bulkActions.itemLabel
      : bulkActions.itemLabelPlural
    : "";

  const toggleRow = (rowId: string) => {
    setToggledRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const expandedCount = sortableIds.filter(isRowExpanded).length;

  const toggleAll = () => {
    // When anything is open, close everything; otherwise open everything.
    const closeAll = expandedCount > 0;
    // In spreadsheet mode the set holds the OPEN rows; otherwise the closed ones.
    const shouldFill = spreadsheetMode ? !closeAll : closeAll;
    setToggledRowIds(shouldFill ? new Set(sortableIds) : new Set());
  };

  // Merge columns for CSV and row activity checks (includes all user-editable fields)
  const allColumns = useMemo(
    () => (detailColumns ? [...columns, ...detailColumns] : columns),
    [columns, detailColumns]
  );

  /**
   * Spreadsheet mode shows every field as a real column and scrolls sideways.
   *
   * The old split kept half the fields behind a disclosure chevron, which hid
   * from the client exactly what was being asked of them — and made those
   * fields unreachable by paste, since paste only writes visible columns.
   */
  const gridColumns = spreadsheetMode ? allColumns : columns;

  // No drawer in spreadsheet mode, so no expand control and no detail row.
  const isExpandable = !spreadsheetMode && (!!detailColumns || !!renderDetail);
  const deleteDialogRow = deleteDialogIndex === null ? null : data[deleteDialogIndex] ?? null;

  const handleDeleteClick = (rowId: string, rowIdx: number) => {
    if (confirmingDeleteId === rowId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmingDeleteId(null);
      onDelete(rowIdx);
    } else {
      setConfirmingDeleteId(rowId);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingDeleteId(null), 3000);
    }
  };

  const clearConfirmingDelete = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingDeleteId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(data, oldIndex, newIndex));
  };

  const canReorder = !!onReorder && !isReadOnly;

  // ===== Spreadsheet paste =====
  //
  // Applies a pasted block with its top-left corner at the focused cell,
  // growing the table when the block is taller than what's there.
  const handlePasteGrid = useMemo(() => {
    if (!spreadsheetMode || !pasteConfig || isReadOnly) return undefined;
    const { onApply, createRow, maxNewRows = 200 } = pasteConfig;

    return (startRow: number, startCol: number, grid: string[][]) => {
      const rowsNeeded = startRow + grid.length;
      const growBy = Math.min(Math.max(0, rowsNeeded - data.length), maxNewRows);

      const next: TRow[] = [
        ...data.map((row) => ({ ...row })),
        ...Array.from({ length: growBy }, () => createRow()),
      ];

      let droppedRows = 0;
      let droppedColumns = 0;

      grid.forEach((line, r) => {
        const target = next[startRow + r];
        if (!target) {
          droppedRows++;
          return;
        }
        line.forEach((rawValue, c) => {
          const column = gridColumns[startCol + c];
          if (!column) {
            // The pasted block is wider than the table.
            droppedColumns++;
            return;
          }
          if (column.type === "readonly") return;
          (target as Record<string, unknown>)[column.key] = coercePastedValue(
            rawValue,
            column
          );
        });
      });

      onApply(next);

      const cellsWritten = grid.length - droppedRows;
      if (droppedRows > 0) {
        showPasteNotice(
          `Pasted ${cellsWritten} row${cellsWritten === 1 ? "" : "s"}. ${droppedRows} more ${droppedRows === 1 ? "was" : "were"} not added — a single paste can add at most ${maxNewRows} rows.`,
          "warn"
        );
      } else if (droppedColumns > 0) {
        showPasteNotice(
          `Pasted ${cellsWritten} row${cellsWritten === 1 ? "" : "s"}. Some pasted columns went past the last column and were ignored.`,
          "warn"
        );
      } else if (grid.length > 1 || grid[0]?.length > 1) {
        showPasteNotice(
          `Pasted ${cellsWritten} row${cellsWritten === 1 ? "" : "s"}${growBy > 0 ? ` (${growBy} new)` : ""}.`,
          "ok"
        );
      }
    };
  }, [spreadsheetMode, pasteConfig, isReadOnly, data, gridColumns, showPasteNotice]);

  // ===== Horizontal overflow cue =====
  //
  // Sideways overflow is far easier to miss than vertical. Without a cue a
  // client can leave columns unfilled simply because they never saw them.
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const [moreColumnsRight, setMoreColumnsRight] = useState(false);

  // ===== Column widths =====
  const widthStorageKey = tableId ? `tp_colwidths_${tableId}` : null;

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Read after mount, not in a lazy useState initializer: this component is
  // server-rendered, so the initializer runs with no `window`, and the empty
  // object it returns is what hydration keeps — stored widths were silently
  // ignored on every page load.
  useEffect(() => {
    if (!widthStorageKey) return;
    try {
      const stored = window.localStorage.getItem(widthStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, number>;
      // Ignore anything that isn't a usable number, so a corrupt entry can't
      // collapse the grid.
      const clean: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "number" && Number.isFinite(value)) {
          clean[key] = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, value));
        }
      }
      if (Object.keys(clean).length > 0) setColumnWidths(clean);
    } catch {
      // Private browsing and blocked site data both throw here.
    }
  }, [widthStorageKey]);

  const persistWidths = useCallback(
    (next: Record<string, number>) => {
      if (!widthStorageKey) return;
      try {
        window.localStorage.setItem(widthStorageKey, JSON.stringify(next));
      } catch {
        // Not being able to remember a width is not worth surfacing.
      }
    },
    [widthStorageKey]
  );

  const widthFor = useCallback(
    (col: ColumnDef): number =>
      columnWidths[col.key] ??
      // An explicit width from the column definition wins over the type default.
      (typeof col.width === "number" ? col.width : undefined) ??
      defaultColumnWidth(col),
    [columnWidths]
  );

  /** Drag state lives in a ref so pointer moves don't re-render on every pixel. */
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(
    null
  );
  const [resizingKey, setResizingKey] = useState<string | null>(null);

  const beginResize = useCallback(
    (col: ColumnDef, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { key: col.key, startX: e.clientX, startWidth: widthFor(col) };
      setResizingKey(col.key);

      const onMove = (ev: PointerEvent) => {
        const drag = resizeRef.current;
        if (!drag) return;
        const next = Math.min(
          MAX_COLUMN_WIDTH,
          Math.max(MIN_COLUMN_WIDTH, drag.startWidth + (ev.clientX - drag.startX))
        );
        setColumnWidths((prev) =>
          prev[drag.key] === next ? prev : { ...prev, [drag.key]: next }
        );
      };

      const onUp = () => {
        resizeRef.current = null;
        setResizingKey(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setColumnWidths((prev) => {
          persistWidths(prev);
          return prev;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [widthFor, persistWidths]
  );

  /** Double-click a divider to drop back to this column's default width. */
  const resetColumnWidth = useCallback(
    (col: ColumnDef) => {
      setColumnWidths((prev) => {
        if (!(col.key in prev)) return prev;
        const next = { ...prev };
        delete next[col.key];
        persistWidths(next);
        return next;
      });
    },
    [persistWidths]
  );

  // The table is as wide as its columns need; the container scrolls.
  const totalGridWidth = useMemo(() => {
    if (!spreadsheetMode) return 0;
    const leading = (bulkEnabled ? 44 : 0) + (isExpandable || canReorder ? 56 : 44);
    const actions = isReadOnly ? 0 : 44;
    return (
      leading + actions + gridColumns.reduce((sum, col) => sum + widthFor(col), 0)
    );
  }, [spreadsheetMode, bulkEnabled, isExpandable, canReorder, isReadOnly, gridColumns, widthFor]);

  useEffect(() => {
    const box = scrollBoxRef.current;
    if (!box || !spreadsheetMode) {
      setMoreColumnsRight(false);
      return;
    }
    const update = () => {
      setMoreColumnsRight(
        box.scrollWidth - box.clientWidth - box.scrollLeft > 4
      );
    };
    update();
    box.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => {
      box.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [spreadsheetMode, gridColumns.length, columnWidths, data.length]);

  // ===== Sticky panes =====
  //
  // Freeze the leading control columns plus the first data column, so the row
  // you're on stays identifiable while scrolling sideways through the rest.
  //
  // The left offsets have to be MEASURED, not assumed: a `w-10` class sets a
  // preferred width, but the table layout algorithm decides the real one from
  // content and padding. Guessing leaves gaps that scrolled cells show through.
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [stickyOffsets, setStickyOffsets] = useState({ num: 0, firstData: 0 });

  useLayoutEffect(() => {
    const row = headerRowRef.current;
    if (!row) return;

    const measure = () => {
      const cells = Array.from(row.children) as HTMLElement[];
      const bulkWidth = bulkEnabled ? (cells[0]?.offsetWidth ?? 0) : 0;
      const numWidth = cells[bulkEnabled ? 1 : 0]?.offsetWidth ?? 0;
      setStickyOffsets((prev) =>
        prev.num === bulkWidth && prev.firstData === bulkWidth + numWidth
          ? prev
          : { num: bulkWidth, firstData: bulkWidth + numWidth }
      );
    };

    measure();
    // Re-measure when the table reflows (window resize, column width changes).
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [bulkEnabled, columns.length, data.length]);

  const numColLeft = stickyOffsets.num;
  const firstDataColLeft = stickyOffsets.firstData;
  // Frozen columns and the pinned header are spreadsheet-mode only.
  const stickyColumns = spreadsheetMode;

  const stickyLeftFor = (colIdx: number): number | undefined =>
    stickyColumns && colIdx === 0 ? firstDataColLeft : undefined;

  // Only give the table its own scroll viewport once there's enough content to
  // warrant it — a short table shouldn't grow an inner scrollbar.
  const useStickyViewport = spreadsheetMode && data.length > 8;

  const tableContent = (
    <div>
      {csvConfig && !isReadOnly && (
        <CsvToolbar
          columns={allColumns}
          sampleRow={csvConfig.sampleRow}
          onImport={csvConfig.onImport}
          sheetName={csvConfig.sheetName}
          exportRows={csvConfig.exportRows}
          extraExport={csvConfig.extraExport}
        />
      )}
      {pasteNotice && (
        <div
          role="status"
          className={cn(
            "mb-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
            pasteNotice.tone === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-green-200 bg-green-50 text-green-700"
          )}
        >
          {pasteNotice.tone === "warn" ? (
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <ClipboardCheck className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          <span>{pasteNotice.text}</span>
        </div>
      )}
      {bulkEnabled && bulkActions && (
        <BulkActionBar
          count={bulkSelection.count}
          itemLabel={bulkLabel}
          onDelete={() => setBulkDeleteOpen(true)}
          onDuplicate={
            bulkActions.onBulkDuplicate ? runBulkDuplicate : undefined
          }
          onClear={bulkSelection.clear}
          isBusy={bulkBusy}
        />
      )}
    <div className="rounded-lg border">
      <div className="relative">
        {spreadsheetMode && moreColumnsRight && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-white to-transparent"
            />
            <span className="pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-slate-900/70 p-0.5 text-white">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </>
        )}
        <Table
          containerRef={scrollBoxRef}
          containerClassName={cn(
            useStickyViewport && "max-h-[70vh] overflow-y-auto"
          )}
          // Fixed layout so declared widths are honoured instead of the
          // browser redistributing them by content length.
          className={cn(spreadsheetMode && "table-fixed")}
          style={
            spreadsheetMode
              ? { width: Math.max(totalGridWidth, 0) || undefined }
              : undefined
          }
        >
          <TableHeader>
            <TableRow ref={headerRowRef} className="bg-primary hover:bg-primary">
              {bulkEnabled && (
                <TableHead
                  className={cn(
                    "w-10 text-center text-white",
                    stickyColumns && "sticky left-0 top-0 z-30 bg-primary"
                  )}
                >
                  <Checkbox
                    checked={
                      headerIndeterminate
                        ? "indeterminate"
                        : headerChecked
                    }
                    onCheckedChange={() => bulkSelection.toggleAll(selectableIds)}
                    disabled={selectableIds.length === 0}
                    aria-label="Select all rows"
                    className="bg-white border-gray-400 shadow-sm hover:bg-gray-50 hover:border-gray-500 focus-visible:ring-white/70 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary data-[state=checked]:border-primary-foreground data-[state=indeterminate]:bg-primary-foreground data-[state=indeterminate]:text-primary data-[state=indeterminate]:border-primary-foreground"
                  />
                </TableHead>
              )}
              <TableHead
                className={cn(
                  "text-center text-white",
                  isExpandable || canReorder ? "w-14" : "w-10",
                  stickyColumns && "sticky top-0 z-30 bg-primary"
                )}
                style={stickyColumns ? { left: numColLeft } : undefined}
              >
                {isExpandable && data.length > 0 ? (
                  <button
                    onClick={toggleAll}
                    className="inline-flex items-center justify-center rounded p-1 hover:bg-white/20 transition-colors"
                    title={expandedCount > 0 ? "Collapse all" : "Expand all"}
                  >
                    {expandedCount > 0 ? (
                      <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 mx-auto" />
                    )}
                  </button>
                ) : (
                  "#"
                )}
              </TableHead>
              {gridColumns.map((col, colIdx) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-white text-[12px] font-semibold uppercase tracking-[0.05em]",
                    spreadsheetMode && "relative",
                    stickyColumns && [
                      "sticky top-0 bg-primary",
                      // Border-collapse drops borders on sticky cells, so the
                      // header/body separator is drawn as an inset shadow.
                      "shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)]",
                      colIdx === 0 ? "z-30" : "z-20",
                    ]
                  )}
                  style={{
                    width: spreadsheetMode ? widthFor(col) : col.width,
                    left: stickyLeftFor(colIdx),
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {renderColumnLabel(col, "text-red-200")}
                    {col.description && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            // A dotted underline on white text over a dark
                            // header is nearly invisible; an explicit icon is
                            // discoverable and keyboard-reachable.
                            className="inline-flex shrink-0 cursor-help items-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70"
                            aria-label={`About ${col.label}`}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-sm bg-slate-800 text-slate-50"
                        >
                          <div className="space-y-1 text-xs leading-relaxed">
                            {col.description}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  {spreadsheetMode && !isReadOnly && (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${col.label}`}
                      onPointerDown={(e) => beginResize(col, e)}
                      onDoubleClick={() => resetColumnWidth(col)}
                      title="Drag to resize · double-click to reset"
                      className={cn(
                        "absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none items-center justify-center",
                        "before:h-1/2 before:w-px before:bg-white/30 before:transition-colors hover:before:bg-white",
                        resizingKey === col.key && "before:bg-white"
                      )}
                    />
                  )}
                </TableHead>
              ))}
              {!isReadOnly && (
                <TableHead
                  className={cn(
                    "w-10 text-white",
                    stickyColumns && "sticky top-0 z-20 bg-primary"
                  )}
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Pinned sample row — read-only reference, not counted in real row numbering */}
            {sampleRow && (
              <TableRow className="bg-brand-lavender-lightest hover:bg-brand-lavender-lightest border-l-4 border-brand-lavender">
                {bulkEnabled && (
                  <TableCell
                    className={cn(
                      "w-10",
                      stickyColumns && "sticky left-0 z-10 bg-inherit"
                    )}
                  />
                )}
                <TableCell
                  className={cn(
                    "py-2 text-center",
                    stickyColumns && "sticky z-10 bg-inherit"
                  )}
                  style={stickyColumns ? { left: numColLeft } : undefined}
                >
                  <span className="inline-flex items-center rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wider">
                    SAMPLE
                  </span>
                </TableCell>
                {gridColumns.map((col, colIdx) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "p-2",
                      stickyColumns && colIdx === 0 && "sticky z-10 bg-inherit"
                    )}
                    style={
                      stickyColumns && colIdx === 0
                        ? { left: firstDataColLeft }
                        : undefined
                    }
                  >
                    <span className="block text-sm text-brand-lavender-darker italic px-1">
                      {sampleRow[col.key] || "—"}
                    </span>
                  </TableCell>
                ))}
                {/* No action buttons in the sample row */}
                <TableCell />
              </TableRow>
            )}
            {/*
              Empty state. Previously this was skipped entirely whenever a
              sample row was present, so a client opened the tab to a greyed-out
              example and a small button at the bottom of the table — with
              nothing obvious to type into and no signal that a row had to be
              added first. Now the prompt always shows, below the sample.
            */}
            {data.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={gridColumns.length + 2 + (bulkEnabled ? 1 : 0)}
                  className="py-8 text-center"
                >
                  {emptyMessage ?? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        Nothing here yet
                        {sampleRow ? " — the row above is an example, not your data." : "."}
                      </p>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onAdd}
                          className="border-primary/40 text-primary hover:border-primary/70"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          {addLabel}
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
            {data.map((row, rowIdx) => {
              const rowId = row.id;
              const bulkRow: BulkRowContext | undefined =
                bulkEnabled && rowId
                  ? {
                      enabled: true,
                      isSelected: bulkSelection.isSelected(rowId),
                      onToggle: (e) =>
                        bulkSelection.toggle(rowId, {
                          index: rowIdx,
                          shiftKey: e.shiftKey,
                          allIds: selectableIds,
                        }),
                    }
                  : bulkEnabled
                    ? { enabled: true, isSelected: false, onToggle: () => {} }
                    : undefined;
              return (
                <SortableRow
                  key={row.id || rowIdx}
                  row={row}
                  rowIdx={rowIdx}
                  columns={gridColumns}
                  detailColumns={spreadsheetMode ? undefined : detailColumns}
                  isExpanded={isRowExpanded(sortableIds[rowIdx])}
                  toggleRow={() => toggleRow(sortableIds[rowIdx])}
                  onUpdate={onUpdate}
                  onDuplicate={onDuplicate}
                  confirmingDeleteId={confirmingDeleteId}
                  handleDeleteClick={handleDeleteClick}
                  clearConfirmingDelete={clearConfirmingDelete}
                  isReadOnly={isReadOnly}
                  canReorder={canReorder}
                  rowIsActive={allColumns.some((col) =>
                    hasCellValue(
                      (row as Record<string, string | boolean | null | undefined>)[col.key]
                    )
                  )}
                  renderCellPrefix={renderCellPrefix}
                  renderCell={renderCell}
                  renderDetail={spreadsheetMode ? undefined : renderDetail}
                  requestDelete={deleteConfirmation ? setDeleteDialogIndex : undefined}
                  bulkRow={bulkRow}
                  numColLeft={numColLeft}
                  firstDataColLeft={firstDataColLeft}
                  stickyColumns={stickyColumns}
                  detailFilledCount={
                    detailColumns && !spreadsheetMode
                      ? {
                          filled: countFilledDetails(
                            row as Record<string, unknown>,
                            detailColumns
                          ),
                          total: detailColumns.length,
                        }
                      : undefined
                  }
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!isReadOnly && !hideAddButton && (
      <div className="border-t p-2">
        <Button variant="outline" size="sm" onClick={onAdd} className="text-primary border-primary/30 hover:border-primary/60">
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      )}
    </div>
    {deleteConfirmation && deleteDialogRow && (
      <ConfirmDeleteDialog
        open={deleteDialogIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogIndex(null);
        }}
        title={deleteConfirmation.title ?? "Delete this row?"}
        fileName={deleteConfirmation.getName?.(deleteDialogRow) ?? "this row"}
        description={
          deleteConfirmation.getDescription?.(deleteDialogRow) ?? (
            <>
              <strong>{deleteConfirmation.getName?.(deleteDialogRow) ?? "This row"}</strong> will be permanently removed.
            </>
          )
        }
        onConfirm={() => {
          if (deleteDialogIndex !== null) onDelete(deleteDialogIndex);
        }}
      />
    )}
    {bulkActions && (
      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!bulkBusy) setBulkDeleteOpen(open);
        }}
        title={`Delete ${bulkSelection.count} ${bulkLabel}?`}
        fileName={`${bulkSelection.count} ${bulkLabel}`}
        description={
          bulkActions.deleteDialogDescription?.(bulkSelection.count) ?? (
            <>
              These rows will be hidden from the checklist. They can be restored
              by an admin. Continue?
            </>
          )
        }
        onConfirm={runBulkDelete}
      />
    )}
    </div>
  );

  // Keyboard navigation + multi-cell paste for the main grid. Detail-panel
  // fields sit outside this and keep ordinary browser behaviour.
  const grid = (
    <GridNavProvider
      spreadsheetMode={spreadsheetMode}
      rowCount={data.length}
      columnCount={gridColumns.length}
      onPasteGrid={handlePasteGrid}
    >
      {tableContent}
    </GridNavProvider>
  );

  if (canReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {grid}
        </SortableContext>
      </DndContext>
    );
  }

  return grid;
}
