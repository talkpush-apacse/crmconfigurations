"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TABLE_DATA,
  type TableNodeData,
  type WorkflowNodeData,
} from "@/lib/workflow/types";

const HANDLE_CLASSES =
  "!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !z-20 hover:!bg-teal-500 transition-colors";

type TableWorkflowData = WorkflowNodeData & Partial<TableNodeData>;

function tableData(data: unknown): TableNodeData {
  const raw = (data ?? {}) as Partial<TableWorkflowData>;
  const columns =
    Array.isArray(raw.columns) && raw.columns.length > 0
      ? raw.columns
      : DEFAULT_TABLE_DATA.columns;
  const rows =
    Array.isArray(raw.rows) && raw.rows.length > 0
      ? raw.rows
      : DEFAULT_TABLE_DATA.rows;

  return {
    label: typeof raw.label === "string" ? raw.label : DEFAULT_TABLE_DATA.label,
    columns,
    rows,
    headerColor:
      typeof raw.headerColor === "string"
        ? raw.headerColor
        : DEFAULT_TABLE_DATA.headerColor,
    compact:
      typeof raw.compact === "boolean" ? raw.compact : DEFAULT_TABLE_DATA.compact,
  };
}

export default function TableNode({ data, selected }: NodeProps) {
  const table = tableData(data);
  const visibleRows = table.rows.slice(0, 8);
  const hiddenCount = Math.max(0, table.rows.length - visibleRows.length);
  const cellPadding = table.compact ? "px-2 py-1" : "px-3 py-2";
  const widthClass =
    table.columns.length >= 4
      ? "min-w-[500px]"
      : table.columns.length === 3
        ? "min-w-[420px]"
        : "min-w-[300px]";

  return (
    <div
      className={cn(
        "relative w-fit max-w-[560px] overflow-hidden rounded-lg border bg-white shadow-sm",
        widthClass,
        selected && "border-teal-500 ring-2 ring-teal-500 ring-offset-1"
      )}
      style={{ borderColor: selected ? "#14B8A6" : "#475569" }}
    >
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={HANDLE_CLASSES}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={HANDLE_CLASSES}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={HANDLE_CLASSES}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={HANDLE_CLASSES}
      />

      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{ backgroundColor: table.headerColor }}
      >
        <Table2 className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {table.label}
        </span>
        <span className="text-xs leading-none opacity-80">≡</span>
      </div>

      <div
        className="grid border-b border-slate-200 text-xs font-semibold text-slate-700"
        style={{
          gridTemplateColumns: `repeat(${table.columns.length}, minmax(90px, 1fr))`,
          backgroundColor: `${table.headerColor}18`,
        }}
      >
        {table.columns.map((column) => (
          <div
            key={column.id}
            className={cn(cellPadding, "truncate border-r border-slate-200 last:border-r-0")}
            title={column.label}
          >
            {column.label}
          </div>
        ))}
      </div>

      {visibleRows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "grid border-b border-slate-100 text-xs text-slate-700 last:border-b-0",
            rowIndex % 2 === 1 ? "bg-slate-50" : "bg-white"
          )}
          style={{
            gridTemplateColumns: `repeat(${table.columns.length}, minmax(90px, 1fr))`,
          }}
        >
          {table.columns.map((column) => {
            const value = row[column.id] ?? "";
            return (
              <div
                key={column.id}
                className={cn(cellPadding, "truncate border-r border-slate-100 last:border-r-0")}
                title={value}
              >
                {value || <span className="text-slate-300">Empty</span>}
              </div>
            );
          })}
        </div>
      ))}

      {hiddenCount > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[10px] font-medium text-slate-500">
          +{hiddenCount} more row{hiddenCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
