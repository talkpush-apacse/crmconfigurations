"use client";

import { useState, useEffect, Fragment } from "react";
import { Plus, Trash2, Copy, X, ChevronRight, ChevronDown } from "lucide-react";
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
import { EditableCell } from "./EditableCell";
import { CsvToolbar } from "./CsvToolbar";
import { cn } from "@/lib/utils";
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
  addLabel?: string;
  csvConfig?: {
    sampleRow: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onImport: (rows: Record<string, any>[]) => void;
    sheetName: string;
  };
}

export function EditableTable({
  columns,
  detailColumns,
  data,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
  addLabel = "Add Row",
  csvConfig,
}: EditableTableProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(data.map((_, i) => i))
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

  return (
    <div>
      {csvConfig && (
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
            <TableRow className="bg-brand-lavender-darker">
              <TableHead className={`${detailColumns ? "w-14" : "w-10"} text-center text-white`}>
                {detailColumns && data.length > 0 ? (
                  <button
                    onClick={toggleAll}
                    className="hover:text-white/80 transition-colors"
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
                <TableHead key={col.key} className="text-white" style={{ width: col.width }}>
                  {col.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dashed border-white/50">
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
                </TableHead>
              ))}
              <TableHead className="w-10 text-white" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 2}
                  className="h-20 text-center text-muted-foreground"
                >
                  No data yet. Click &quot;{addLabel}&quot; to add a row.
                </TableCell>
              </TableRow>
            )}
            {data.map((row, rowIdx) => (
              <Fragment key={(row.id as string) || rowIdx}>
                <TableRow className={cn("bg-yellow-50/30 transition-colors hover:bg-yellow-50/60", detailColumns && !expandedRows.has(rowIdx) && "border-b border-gray-200")}>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {detailColumns ? (
                      <button
                        onClick={() => toggleRow(rowIdx)}
                        className="inline-flex items-center gap-0.5 hover:text-primary transition-colors"
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
                  <TableCell className="p-1.5">
                    <div className="flex items-center gap-0.5">
                      {onDuplicate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onDuplicate(rowIdx)}
                          title="Duplicate row"
                        >
                          <Copy className="h-3.5 w-3.5" />
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
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => setConfirmingDelete(null)}
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteClick(rowIdx)}
                          title="Delete row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
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
                                        <span className="cursor-help border-b border-dashed border-gray-300">
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
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" onClick={onAdd} className="text-primary">
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
    </div>
  );
}
