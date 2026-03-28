"use client";

import { useState, useEffect, Fragment, useMemo } from "react";
import { Plus, Trash2, Copy, X, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { arrayMove } from "@/lib/utils";
import { useChecklistContext } from "@/lib/checklist-context";
import type { ColumnDef } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EditableTableProps {
  columns: ColumnDef[];
  detailColumns?: ColumnDef[];
  data: any[];
  onUpdate: (index: number, field: string, value: string | boolean) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate?: (index: number) => void;
  /** Called with the reordered array when a row is dragged to a new position */
  onReorder?: (reorderedData: any[]) => void;
  addLabel?: string;
  /** Optional pinned sample row shown at the top of the table body (read-only) */
  sampleRow?: Record<string, string>;
  csvConfig?: {
    sampleRow: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onImport: (rows: Record<string, any>[]) => void;
    sheetName: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableRow({
  row,
  rowIdx,
  columns,
  detailColumns,
  expandedRows,
  toggleRow,
  onUpdate,
  onDuplicate,
  confirmingDelete,
  handleDeleteClick,
  setConfirmingDelete,
  isReadOnly,
  canReorder,
}: {
  row: any;
  rowIdx: number;
  columns: ColumnDef[];
  detailColumns?: ColumnDef[];
  expandedRows: Set<number>;
  toggleRow: (idx: number) => void;
  onUpdate: (index: number, field: string, value: string | boolean) => void;
  onDuplicate?: (index: number) => void;
  confirmingDelete: number | null;
  handleDeleteClick: (idx: number) => void;
  setConfirmingDelete: (idx: number | null) => void;
  isReadOnly: boolean;
  canReorder: boolean;
}) {
  const sortableId = (row.id as string) || `row-${rowIdx}`;
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
          detailColumns && !expandedRows.has(rowIdx) && "border-b border-gray-200",
          isDragging && "bg-blue-50 shadow-sm"
        )}
      >
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
            {detailColumns ? (
              <button
                onClick={() => toggleRow(rowIdx)}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-gray-100 hover:text-primary transition-colors"
                title={expandedRows.has(rowIdx) ? "Collapse details" : "Expand details"}
              >
                {expandedRows.has(rowIdx) ? (
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
            <EditableCell
              value={row[col.key] as string | boolean}
              type={col.type}
              options={col.options}
              onChange={(val) => onUpdate(rowIdx, col.key, val)}
              placeholder={col.label}
              validation={col.validation}
            />
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
              {confirmingDelete === rowIdx ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => handleDeleteClick(rowIdx)}
                    title="Confirm delete"
                  >
                    Delete?
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-gray-100"
                    onClick={() => setConfirmingDelete(null)}
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
                  onClick={() => handleDeleteClick(rowIdx)}
                  title="Delete row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
      {detailColumns && expandedRows.has(rowIdx) && (
        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
          <TableCell colSpan={columns.length + 2} className="p-0">
            <div className="px-6 py-4 ml-8 border-l-2 border-primary/20 bg-gray-50 rounded-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {detailColumns.map((col) => {
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
                                {col.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs">{col.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          col.label
                        )}
                      </label>
                      <EditableCell
                        value={row[col.key] as string | boolean}
                        type={col.type}
                        options={col.options}
                        onChange={(val) => onUpdate(rowIdx, col.key, val)}
                        placeholder={col.label}
                        validation={col.validation}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export function EditableTable({
  columns,
  detailColumns,
  data,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
  onReorder,
  addLabel = "Add Row",
  sampleRow,
  csvConfig,
}: EditableTableProps) {
  const { isReadOnly } = useChecklistContext();
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(data.map((_, i) => i))
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Stable IDs for sortable context
  const sortableIds = useMemo(
    () => data.map((row, i) => (row.id as string) || `row-${i}`),
    [data]
  );

  // Re-expand all rows when data length changes (add/delete/duplicate)
  useEffect(() => {
    if (detailColumns) {
      setExpandedRows(new Set(data.map((_, i) => i)));
    }
  }, [data.length, detailColumns]);

  const toggleRow = (rowIdx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) {
        next.delete(rowIdx);
      } else {
        next.add(rowIdx);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedRows.size === data.length) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(data.map((_, i) => i)));
    }
  };

  // Merge columns for CSV (includes all fields)
  const allColumns = detailColumns ? [...columns, ...detailColumns] : columns;

  const handleDeleteClick = (rowIdx: number) => {
    if (confirmingDelete === rowIdx) {
      onDelete(rowIdx);
      setConfirmingDelete(null);
    } else {
      setConfirmingDelete(rowIdx);
    }
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
        />
      )}
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-600">
              <TableHead className={`${detailColumns ? "w-14" : canReorder ? "w-14" : "w-10"} text-center text-white`}>
                {detailColumns && data.length > 0 ? (
                  <button
                    onClick={toggleAll}
                    className="inline-flex items-center justify-center rounded p-1 hover:bg-white/20 transition-colors"
                    title={expandedRows.size === data.length ? "Collapse all" : "Expand all"}
                  >
                    {expandedRows.size === data.length ? (
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
                          {col.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-slate-50">
                        <p className="text-xs">{col.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    col.label
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
                  colSpan={columns.length + 2}
                  className="h-20 text-center text-muted-foreground"
                >
                  No data yet. Click &quot;{addLabel}&quot; to add a row.
                </TableCell>
              </TableRow>
            )}
            {/* Pinned sample row — read-only reference, not counted in real row numbering */}
            {sampleRow && (
              <TableRow className="bg-blue-50 hover:bg-blue-50 border-l-4 border-blue-300">
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
            {data.map((row, rowIdx) => (
              <SortableRow
                key={(row.id as string) || rowIdx}
                row={row}
                rowIdx={rowIdx}
                columns={columns}
                detailColumns={detailColumns}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                onUpdate={onUpdate}
                onDuplicate={onDuplicate}
                confirmingDelete={confirmingDelete}
                handleDeleteClick={handleDeleteClick}
                setConfirmingDelete={setConfirmingDelete}
                isReadOnly={isReadOnly}
                canReorder={canReorder}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {!isReadOnly && (
      <div className="border-t p-2">
        <Button variant="outline" size="sm" onClick={onAdd} className="text-primary border-primary/30 hover:border-primary/60">
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      )}
    </div>
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
