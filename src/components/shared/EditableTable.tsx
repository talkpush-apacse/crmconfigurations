"use client";

import { useState, Fragment, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { Plus, Trash2, Copy, X, ChevronRight, ChevronDown, GripVertical, AlertTriangle, ClipboardCheck } from "lucide-react";
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
          // Fully opaque: the frozen columns inherit this, and a translucent
          // background would let scrolled cells show through them.
          rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50",
          (detailColumns || renderDetail) && !isExpanded && "border-b border-gray-200",
          isDragging && "bg-brand-lavender-lightest shadow-sm",
          bulkRow?.isSelected && "bg-brand-sage-lightest hover:bg-brand-sage-lightest"
        )}
      >
        {bulkRow?.enabled && (
          <TableCell
            className="sticky left-0 z-10 w-10 bg-inherit text-center"
            style={{ left: 0 }}
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
          className="sticky z-10 bg-inherit text-center text-xs text-muted-foreground"
          style={{ left: numColLeft }}
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
                {/* Collapsed rows would otherwise hide their own emptiness. */}
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
              col.type === "textarea"
                ? "min-w-[180px]"
                : col.type === "text"
                  ? "min-w-[120px]"
                  : "",
              colIdx === 0 && "sticky z-10 bg-inherit"
            )}
            style={colIdx === 0 ? { left: firstDataColLeft } : undefined}
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
                        {col.description ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-gray-400/70">
                                {renderColumnLabel(col, "text-red-500")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs">{col.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          renderColumnLabel(col, "text-red-500")
                        )}
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
  pasteConfig,
  csvConfig,
  bulkActions,
}: EditableTableProps<TRow>) {
  const { isReadOnly } = useChecklistContext();
  // Track confirm by stable row ID (not index) so drag-reorder doesn't target the wrong row
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Detail panels start CLOSED. Expanded-by-default made one row ~400px tall,
  // so two rows could never be compared side by side.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
    () => new Set()
  );
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
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const expandedCount = sortableIds.filter((id) => expandedRowIds.has(id)).length;

  const toggleAll = () => {
    // When anything is open, close everything; otherwise open everything.
    if (expandedCount > 0) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(sortableIds));
    }
  };

  // Merge columns for CSV and row activity checks (includes all user-editable fields)
  const allColumns = useMemo(
    () => (detailColumns ? [...columns, ...detailColumns] : columns),
    [columns, detailColumns]
  );

  const isExpandable = !!detailColumns || !!renderDetail;
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
    if (!pasteConfig || isReadOnly) return undefined;
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
          const column = columns[startCol + c];
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
  }, [pasteConfig, isReadOnly, data, columns, showPasteNotice]);

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

  const stickyLeftFor = (colIdx: number): number | undefined =>
    colIdx === 0 ? firstDataColLeft : undefined;

  // Only give the table its own scroll viewport once there's enough content to
  // warrant it — a short table shouldn't grow an inner scrollbar.
  const useStickyViewport = data.length > 8;

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
      <div>
        <Table
          containerClassName={cn(
            useStickyViewport && "max-h-[70vh] overflow-y-auto"
          )}
        >
          <TableHeader>
            <TableRow ref={headerRowRef} className="bg-primary hover:bg-primary">
              {bulkEnabled && (
                <TableHead
                  className="sticky left-0 top-0 z-30 w-10 bg-primary text-center text-white"
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
                  "sticky top-0 z-30 bg-primary text-center text-white",
                  isExpandable || canReorder ? "w-14" : "w-10"
                )}
                style={{ left: numColLeft }}
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
              {columns.map((col, colIdx) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "sticky top-0 bg-primary text-white text-[12px] font-semibold uppercase tracking-[0.05em]",
                    // Border-collapse drops borders on sticky cells, so the
                    // header/body separator is drawn as an inset shadow.
                    "shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)]",
                    colIdx === 0 ? "z-30" : "z-20"
                  )}
                  style={{ width: col.width, left: stickyLeftFor(colIdx) }}
                >
                  {col.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-white/60">
                          {renderColumnLabel(col, "text-red-200")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-slate-50">
                        <p className="text-xs">{col.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    renderColumnLabel(col, "text-red-200")
                  )}
                </TableHead>
              ))}
              {!isReadOnly && (
                <TableHead className="sticky top-0 z-20 w-10 bg-primary text-white" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Empty state — only show when there is no data AND no sample row */}
            {data.length === 0 && !sampleRow && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 2 + (bulkEnabled ? 1 : 0)}
                  className="h-20 text-center text-muted-foreground"
                >
                  {emptyMessage ?? <>No data yet. Click &quot;{addLabel}&quot; to add a row.</>}
                </TableCell>
              </TableRow>
            )}
            {/* Pinned sample row — read-only reference, not counted in real row numbering */}
            {sampleRow && (
              <TableRow className="bg-brand-lavender-lightest hover:bg-brand-lavender-lightest border-l-4 border-brand-lavender">
                {bulkEnabled && (
                  <TableCell className="sticky left-0 z-10 w-10 bg-inherit" />
                )}
                <TableCell
                  className="sticky z-10 bg-inherit py-2 text-center"
                  style={{ left: numColLeft }}
                >
                  <span className="inline-flex items-center rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wider">
                    SAMPLE
                  </span>
                </TableCell>
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={col.key}
                    className={cn("p-2", colIdx === 0 && "sticky z-10 bg-inherit")}
                    style={colIdx === 0 ? { left: firstDataColLeft } : undefined}
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
                  columns={columns}
                  detailColumns={detailColumns}
                  isExpanded={expandedRowIds.has(sortableIds[rowIdx])}
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
                  renderDetail={renderDetail}
                  requestDelete={deleteConfirmation ? setDeleteDialogIndex : undefined}
                  bulkRow={bulkRow}
                  numColLeft={numColLeft}
                  firstDataColLeft={firstDataColLeft}
                  detailFilledCount={
                    detailColumns
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
      rowCount={data.length}
      columnCount={columns.length}
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
