"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, X } from "lucide-react";
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
import type { ColumnDef } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EditableTableProps {
  columns: ColumnDef[];
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
  data,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate,
  addLabel = "Add Row",
  csvConfig,
}: EditableTableProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);

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
          columns={columns}
          sampleRow={csvConfig.sampleRow}
          onImport={csvConfig.onImport}
          sheetName={csvConfig.sheetName}
        />
      )}
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#535FC1]">
              <TableHead className="w-10 text-center text-white">#</TableHead>
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
              <TableRow key={(row.id as string) || rowIdx} className="bg-yellow-50/30">
                <TableCell className="text-center text-xs text-muted-foreground">
                  {rowIdx + 1}
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
