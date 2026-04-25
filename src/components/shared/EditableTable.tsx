"use client";

import { useState, Fragment, useMemo, useRef } from "react";
import { Plus, Trash2, Copy, X, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
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
  csvConfig?: {
    sampleRow: Record<string, string>;
    onImport: (rows: Record<string, string>[]) => void;
    sheetName: string;
    exportRows?: Record<string, string>[];
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
          rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60",
          (detailColumns || renderDetail) && !isExpanded && "border-b border-gray-200",
          isDragging && "bg-blue-50 shadow-sm",
          bulkRow?.isSelected && "bg-teal-50 hover:bg-teal-50"
        )}
      >
        {bulkRow?.enabled && (
          <TableCell className="w-10 text-center">
            <Checkbox
              checked={bulkRow.isSelected}
              onClick={bulkRow.onToggle}
              onCheckedChange={() => {}}
              aria-label={`Select row ${rowIdx + 1}`}
            />
          </TableCell>
        )}
        <TableCell className="text-center text-xs text-muted-foreground">
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
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-gray-100 hover:text-primary transition-colors"
                title={isExpanded ? "Collapse details" : "Expand details"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span>{rowIdx + 1}</span>
              </button>
            ) : (
              rowIdx + 1
            )}
          </div>
        </TableCell>
        {columns.map((col) => (
          <TableCell
            key={col.key}
            className={`p-1.5${col.type === "textarea" ? " min-w-[180px]" : col.type === "text" ? " min-w-[120px]" : ""}`}
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
  csvConfig,
  bulkActions,
}: EditableTableProps<TRow>) {
  const { isReadOnly } = useChecklistContext();
  // Track confirm by stable row ID (not index) so drag-reorder doesn't target the wrong row
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsedRowIds, setCollapsedRowIds] = useState<Set<string>>(
    () => new Set()
  );
  const [deleteDialogIndex, setDeleteDialogIndex] = useState<number | null>(null);

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
    setCollapsedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const visibleCollapsedCount = sortableIds.filter((id) => collapsedRowIds.has(id)).length;

  const toggleAll = () => {
    // When any rows are collapsed, expand all; otherwise collapse all
    if (visibleCollapsedCount > 0) {
      setCollapsedRowIds(new Set());
    } else {
      setCollapsedRowIds(new Set(sortableIds));
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

  const tableContent = (
    <div>
      {csvConfig && !isReadOnly && (
        <CsvToolbar
          columns={allColumns}
          sampleRow={csvConfig.sampleRow}
          onImport={csvConfig.onImport}
          sheetName={csvConfig.sheetName}
          exportRows={csvConfig.exportRows}
        />
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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-600">
              {bulkEnabled && (
                <TableHead className="w-10 text-center text-white">
                  <Checkbox
                    checked={
                      headerIndeterminate
                        ? "indeterminate"
                        : headerChecked
                    }
                    onCheckedChange={() => bulkSelection.toggleAll(selectableIds)}
                    disabled={selectableIds.length === 0}
                    aria-label="Select all rows"
                    className="border-2 border-white bg-white/15 hover:bg-white/35 focus-visible:ring-white/60 data-[state=checked]:bg-white data-[state=checked]:text-blue-600 data-[state=checked]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-blue-600 data-[state=indeterminate]:border-white"
                  />
                </TableHead>
              )}
              <TableHead className={`${isExpandable ? "w-14" : canReorder ? "w-14" : "w-10"} text-center text-white`}>
                {isExpandable && data.length > 0 ? (
                  <button
                    onClick={toggleAll}
                    className="inline-flex items-center justify-center rounded p-1 hover:bg-white/20 transition-colors"
                    title={visibleCollapsedCount === 0 ? "Collapse all" : "Expand all"}
                  >
                    {visibleCollapsedCount === 0 ? (
                      <ChevronDown className="h-3.5 w-3.5 mx-auto" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 mx-auto" />
                    )}
                  </button>
                ) : (
                  "#"
                )}
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} className="text-white text-[12px] font-semibold uppercase tracking-[0.05em]" style={{ width: col.width }}>
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
              {!isReadOnly && <TableHead className="w-10 text-white" />}
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
              <TableRow className="bg-blue-50 hover:bg-blue-50 border-l-4 border-blue-300">
                {bulkEnabled && <TableCell className="w-10" />}
                <TableCell className="text-center py-2">
                  <span className="inline-flex items-center rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wider">
                    SAMPLE
                  </span>
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key} className="p-2">
                    <span className="block text-sm text-blue-500 italic px-1">
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
                  isExpanded={!collapsedRowIds.has(sortableIds[rowIdx])}
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

  if (canReorder) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {tableContent}
        </SortableContext>
      </DndContext>
    );
  }

  return tableContent;
}
