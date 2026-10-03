"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Plus, RotateCcw, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANNOTATION_BORDER_PRESETS, ANNOTATION_FILL_PRESETS, NODE_COLOR_PALETTE } from "@/lib/workflow/constants";
import { cn } from "@/lib/utils";
import {
  ACTOR_CONFIG,
  DEFAULT_TABLE_DATA,
  NODE_TYPE_CONFIG,
  TALKPUSH_ACTIONS,
  type ActorType,
  type AnnotationNodeData,
  type NodeType,
  type TableColumn,
  type TableNodeData,
  type WorkflowNodeData,
} from "@/lib/workflow/types";

import ProcessMapProperties, { type StepOption } from "./ProcessMapProperties";

interface NodePropertiesProps {
  nodeId: string;
  data: WorkflowNodeData;
  diagramStyle: "classic" | "process_map";
  /** Other steps on this page, for pointing a jump marker or a note at one. */
  otherSteps: StepOption[];
  onChange: (id: string, updates: Partial<WorkflowNodeData>) => void;
  onDataChange: (id: string, dataUpdates: Partial<WorkflowNodeData["data"]>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const NODE_TYPES = Object.entries(NODE_TYPE_CONFIG) as [keyof typeof NODE_TYPE_CONFIG, (typeof NODE_TYPE_CONFIG)[keyof typeof NODE_TYPE_CONFIG]][];
const ACTOR_TYPES = Object.entries(ACTOR_CONFIG) as [ActorType, (typeof ACTOR_CONFIG)[ActorType]][];

const FEASIBILITY_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "likely", label: "Likely" },
  { value: "needs_review", label: "Needs Review" },
];

const TABLE_HEADER_COLORS = [
  { value: "#475569", label: "Slate" },
  { value: "#00BFA5", label: "Teal" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#10B981", label: "Green" },
];

type TableWorkflowNodeData = WorkflowNodeData & Partial<TableNodeData>;

function normalizeTableData(data: WorkflowNodeData): TableNodeData {
  const table = data as TableWorkflowNodeData;
  const columns =
    Array.isArray(table.columns) && table.columns.length > 0
      ? table.columns
      : DEFAULT_TABLE_DATA.columns;
  const rows =
    Array.isArray(table.rows) && table.rows.length > 0
      ? table.rows
      : DEFAULT_TABLE_DATA.rows;

  return {
    label: data.label || DEFAULT_TABLE_DATA.label,
    columns,
    rows,
    headerColor:
      typeof table.headerColor === "string"
        ? table.headerColor
        : DEFAULT_TABLE_DATA.headerColor,
    compact:
      typeof table.compact === "boolean" ? table.compact : DEFAULT_TABLE_DATA.compact,
  };
}

function createColumnId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `col_${randomId.replace(/-/g, "").slice(0, 10)}`;
  return `col_${Date.now()}`;
}

export default function NodeProperties({
  nodeId,
  data,
  diagramStyle,
  otherSteps,
  onChange,
  onDataChange,
  onDelete,
  onClose,
}: NodePropertiesProps) {
  // ── Table nodes — structured data editor ──────────────────────────────────
  if (data.type === "table") {
    const table = normalizeTableData(data);

    const updateTable = (updates: Partial<TableNodeData>) => {
      onChange(nodeId, updates as Partial<WorkflowNodeData>);
    };

    const updateColumn = (columnId: string, label: string) => {
      updateTable({
        columns: table.columns.map((column) =>
          column.id === columnId ? { ...column, label } : column
        ),
      });
    };

    const addColumn = () => {
      if (table.columns.length >= 6) return;
      const id = createColumnId();
      const nextColumn: TableColumn = {
        id,
        label: `Column ${table.columns.length + 1}`,
      };
      updateTable({
        columns: [...table.columns, nextColumn],
        rows: table.rows.map((row) => ({ ...row, [id]: "" })),
      });
    };

    const deleteColumn = (columnId: string) => {
      if (table.columns.length <= 1) return;
      updateTable({
        columns: table.columns.filter((column) => column.id !== columnId),
        rows: table.rows.map((row) => {
          const nextRow = { ...row };
          delete nextRow[columnId];
          return nextRow;
        }),
      });
    };

    const updateCell = (rowIndex: number, columnId: string, value: string) => {
      updateTable({
        rows: table.rows.map((row, index) =>
          index === rowIndex ? { ...row, [columnId]: value } : row
        ),
      });
    };

    const addRow = () => {
      if (table.rows.length >= 20) return;
      const row = table.columns.reduce<Record<string, string>>((acc, column) => {
        acc[column.id] = "";
        return acc;
      }, {});
      updateTable({ rows: [...table.rows, row] });
    };

    const deleteRow = (rowIndex: number) => {
      if (table.rows.length <= 1) return;
      updateTable({ rows: table.rows.filter((_, index) => index !== rowIndex) });
    };

    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Table Properties</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={table.label}
              onChange={(event) => onChange(nodeId, { label: event.target.value })}
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Header Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TABLE_HEADER_COLORS.map((color) => {
                const selected = table.headerColor === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    aria-label={color.label}
                    onClick={() => updateTable({ headerColor: color.value })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 border-white shadow-sm transition",
                      selected && "ring-2 ring-gray-800 ring-offset-1"
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={table.compact}
            onClick={() => updateTable({ compact: !table.compact })}
            className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left transition-colors hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-700">Compact Mode</span>
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                table.compact ? "bg-teal-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  table.compact ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </span>
          </button>

          <section className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Columns
              </p>
              <span className="text-[10px] text-gray-400">
                {table.columns.length}/6
              </span>
            </div>
            <div className="space-y-2">
              {table.columns.map((column) => (
                <div key={column.id} className="flex items-center gap-2">
                  <Input
                    value={column.label}
                    onChange={(event) =>
                      updateColumn(column.id, event.target.value)
                    }
                    className="h-8 border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={table.columns.length <= 1}
                    onClick={() => deleteColumn(column.id)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete column"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={table.columns.length >= 6}
              onClick={addColumn}
              className="mt-2 w-full justify-start gap-1.5 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Column
            </Button>
          </section>

          <section className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Table Data
              </p>
              <span className="text-[10px] text-gray-400">
                {table.rows.length}/20
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
              <div
                className="grid min-w-max border-b border-gray-200 bg-gray-50"
                style={{
                  gridTemplateColumns: `repeat(${table.columns.length}, minmax(7rem, 1fr)) 2rem`,
                }}
              >
                {table.columns.map((column) => (
                  <div
                    key={column.id}
                    className="truncate border-r border-gray-200 px-2 py-1.5 text-[11px] font-semibold text-gray-600 last:border-r-0"
                    title={column.label}
                  >
                    {column.label || "Untitled"}
                  </div>
                ))}
                <div className="px-2 py-1.5" />
              </div>

              {table.rows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid min-w-max border-b border-gray-100 last:border-b-0"
                  style={{
                    gridTemplateColumns: `repeat(${table.columns.length}, minmax(7rem, 1fr)) 2rem`,
                  }}
                >
                  {table.columns.map((column) => (
                    <div key={column.id} className="border-r border-gray-100 p-1">
                      <Input
                        value={row[column.id] ?? ""}
                        onChange={(event) =>
                          updateCell(rowIndex, column.id, event.target.value)
                        }
                        className="h-7 border border-gray-200 bg-white px-2 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-center p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={table.rows.length <= 1}
                      onClick={() => deleteRow(rowIndex)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={table.rows.length >= 20}
              onClick={addRow}
              className="mt-2 w-full justify-start gap-1.5 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(nodeId)}
            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Table
          </Button>
        </div>
      </div>
    );
  }

  // ── Container nodes (swimlane / frame) — simplified panel ──────────────────
  if (data.type === "swimlane" || data.type === "frame") {
    const label = data.type === "swimlane" ? "Swimlane" : "Frame";
    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{label} Properties</h2>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Label</label>
            <Input
              value={data.label}
              onChange={(e) => onChange(nodeId, { label: e.target.value })}
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Double-click the {label.toLowerCase()} label on the canvas to rename inline. Drag nodes into this {label.toLowerCase()} to group them — they will move together.
          </p>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(nodeId)}
            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete {label}
          </Button>
        </div>
      </div>
    );
  }

  // ── Annotation nodes — visual-only properties ──────────────────────────────
  if ((data as unknown as AnnotationNodeData).isAnnotation) {
    const ann = data as unknown as AnnotationNodeData;

    const update = (updates: Partial<AnnotationNodeData>) => {
      onChange(nodeId, updates as unknown as Partial<WorkflowNodeData>);
    };

    const FONT_SIZES = [12, 14, 16, 20, 24];

    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Annotation Properties</h2>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Label */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Label</p>
            <Input
              value={ann.label}
              onChange={(e) => update({ label: e.target.value })}
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 mb-2"
              placeholder="Label text…"
            />
            {/* Text style controls */}
            <div className="flex items-center gap-2">
              {/* Bold / Italic */}
              <button
                type="button"
                onClick={() => update({ bold: !ann.bold })}
                className={cn(
                  "h-7 w-7 rounded border flex items-center justify-center text-xs font-bold transition-colors",
                  ann.bold
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => update({ italic: !ann.italic })}
                className={cn(
                  "h-7 w-7 rounded border flex items-center justify-center transition-colors",
                  ann.italic
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              {/* Font size */}
              <Select
                value={String(ann.fontSize)}
                onValueChange={(v) => update({ fontSize: Number(v) })}
              >
                <SelectTrigger className="h-7 w-16 text-xs border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((sz) => (
                    <SelectItem key={sz} value={String(sz)} className="text-xs">{sz}px</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Text align */}
              <div className="flex rounded border border-gray-300 overflow-hidden ml-auto">
                {(["left", "center", "right"] as const).map((align) => {
                  const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() => update({ textAlign: align })}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center transition-colors",
                        ann.textAlign === align
                          ? "bg-teal-600 text-white"
                          : "text-gray-500 hover:bg-gray-50"
                      )}
                      title={`Align ${align}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Appearance</p>

            {/* Fill color */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Fill</label>
              <div className="flex flex-wrap gap-1.5">
                {ANNOTATION_FILL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => update({ fillColor: preset.value })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition shrink-0",
                      ann.fillColor === preset.value
                        ? "border-teal-500 ring-2 ring-teal-500 ring-offset-1"
                        : "border-gray-200 hover:border-gray-400"
                    )}
                    style={{
                      backgroundColor: preset.value === "transparent" ? "transparent" : preset.value,
                      backgroundImage: preset.value === "transparent"
                        ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)"
                        : undefined,
                      backgroundSize: preset.value === "transparent" ? "6px 6px" : undefined,
                      backgroundPosition: preset.value === "transparent" ? "0 0, 3px 3px" : undefined,
                    }}
                  />
                ))}
              </div>
              <Input
                value={ann.fillColor === "transparent" ? "" : ann.fillColor}
                onChange={(e) => update({ fillColor: e.target.value || "transparent" })}
                placeholder="#hex or transparent"
                className="mt-1.5 h-7 text-xs border-gray-300 bg-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Border color */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Border</label>
              <div className="flex flex-wrap gap-1.5">
                {ANNOTATION_BORDER_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => update({ borderColor: preset.value })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition shrink-0",
                      ann.borderColor === preset.value
                        ? "border-teal-500 ring-2 ring-teal-500 ring-offset-1"
                        : "border-gray-200 hover:border-gray-400"
                    )}
                    style={{
                      backgroundColor: preset.value === "none" ? "transparent" : preset.value,
                      backgroundImage: preset.value === "none"
                        ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)"
                        : undefined,
                      backgroundSize: preset.value === "none" ? "6px 6px" : undefined,
                      backgroundPosition: preset.value === "none" ? "0 0, 3px 3px" : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Border style */}
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Border Style</label>
              <div className="flex rounded-md border border-gray-200 overflow-hidden w-fit">
                {(["solid", "dashed", "none"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => update({ borderStyle: style })}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                      ann.borderStyle === style
                        ? "bg-teal-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Opacity</label>
                <span className="text-xs text-gray-500 tabular-nums">{Math.round(ann.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(ann.opacity * 100)}
                onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
                className="w-full h-1.5 accent-teal-600"
              />
            </div>
          </section>

          {/* Layer */}
          <section className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Layer</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ zIndex: -3 })}
                className="text-xs h-7 border-gray-300"
              >
                Send to back
              </Button>
              <span className="text-xs text-gray-400 tabular-nums flex-1 text-center">
                z: {ann.zIndex}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ zIndex: 10 })}
                className="text-xs h-7 border-gray-300"
              >
                Bring to front
              </Button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(nodeId)}
            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Annotation
          </Button>
        </div>
      </div>
    );
  }

  const showTalkpushStage = data.type === "stage";
  const showTalkpushAction =
    data.type === "communication" || data.type === "manual_action";
  const showWaitDuration = data.type === "wait";
  const showTargetFolder =
    data.type === "manual_action" || data.type === "stage";

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Node Properties</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Node Type
          </label>
          <Select
            value={data.type}
            onValueChange={(v) => onChange(nodeId, { type: v as NodeType })}
          >
            <SelectTrigger className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_TYPES.map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Node Color */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-700">
              Node Color
            </label>
            <Button
              variant="ghost"
              size="sm"
              disabled={!data.customColor}
              onClick={() => onChange(nodeId, { customColor: null })}
              className="h-7 px-2 text-xs text-gray-500 hover:text-gray-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {NODE_COLOR_PALETTE.map((color) => {
              const selected =
                data.customColor?.background === color.background &&
                data.customColor?.border === color.border;
              return (
                <button
                  key={color.name}
                  type="button"
                  title={color.name}
                  onClick={() =>
                    onChange(nodeId, {
                      customColor: {
                        name: color.name,
                        background: color.background,
                        border: color.border,
                      },
                    })
                  }
                  className={cn(
                    "h-6 w-6 cursor-pointer rounded-full border border-white shadow-sm transition",
                    selected && "ring-2 ring-gray-800 ring-offset-1"
                  )}
                  style={{ backgroundColor: color.border }}
                />
              );
            })}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Label <span className="text-red-500">*</span>
          </label>
          <Input
            value={data.label}
            onChange={(e) => onChange(nodeId, { label: e.target.value })}
            className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Actor */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Actor (optional)
          </label>
          <Select
            value={data.actor ?? "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") {
                onChange(nodeId, { actor: undefined, actorLabel: "" });
                return;
              }
              const actor = v as ActorType;
              onChange(nodeId, {
                actor,
                actorLabel: data.actorLabel || ACTOR_CONFIG[actor].label,
              });
            }}
          >
            <SelectTrigger className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500">
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not specified</SelectItem>
              {ACTOR_TYPES.map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actor Label */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Actor Label
          </label>
          <Input
            value={data.actorLabel ?? ""}
            onChange={(e) => onChange(nodeId, { actorLabel: e.target.value })}
            placeholder="Not specified"
            className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Notes
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => onChange(nodeId, { notes: e.target.value })}
            rows={3}
            placeholder="Describe this step..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
          />
        </div>

        {/* Feasibility */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Feasibility
          </label>
          <Select
            value={data.feasibility}
            onValueChange={(v) =>
              onChange(nodeId, {
                feasibility: v as WorkflowNodeData["feasibility"],
              })
            }
          >
            <SelectTrigger className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEASIBILITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(data.feasibility === "likely" || data.feasibility === "needs_review") && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Feasibility Note
            </label>
            <textarea
              value={data.feasibilityNote ?? ""}
              onChange={(e) =>
                onChange(nodeId, { feasibilityNote: e.target.value })
              }
              rows={2}
              placeholder="Explain the concern..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
            />
          </div>
        )}

        {diagramStyle === "process_map" && <ProcessMapProperties nodeId={nodeId} data={data} otherSteps={otherSteps} onChange={onChange} />}

        {/* Staff only: never sent to clients (the server removes it from every client view) */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Staff only
          </p>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Internal notes
          </label>
          <textarea
            value={data.internalNotes ?? ""}
            onChange={(e) => onChange(nodeId, { internalNotes: e.target.value })}
            rows={2}
            placeholder="Assumptions, risks, ticket numbers. Clients never see this."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
          />
          <label className="text-sm font-medium text-gray-700 mt-3 mb-1 block">
            Who can see this step
          </label>
          <Select
            value={data.visibility === "internal" ? "internal" : "client"}
            onValueChange={(v) =>
              onChange(nodeId, { visibility: v === "internal" ? "internal" : "client" })
            }
          >
            <SelectTrigger className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Clients and staff</SelectItem>
              <SelectItem value="internal">Staff only (hidden from clients)</SelectItem>
            </SelectContent>
          </Select>
          {data.visibility === "internal" && (
            <p className="mt-1 text-xs text-gray-500">
              This step and its connectors are removed from client links, exports and shared views.
            </p>
          )}
        </div>

        {/* Dynamic data fields */}
        {showTalkpushStage && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Talkpush Config
            </p>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Stage Name
            </label>
            <Input
              value={data.data?.talkpushStage ?? ""}
              onChange={(e) =>
                onDataChange(nodeId, { talkpushStage: e.target.value })
              }
              placeholder="e.g. Applied, Shortlisted"
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}

        {showTalkpushAction && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Talkpush Config
            </p>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Autoflow Action
            </label>
            <Select
              value={data.data?.talkpushAction ?? ""}
              onValueChange={(v) => onDataChange(nodeId, { talkpushAction: v })}
            >
              <SelectTrigger className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {TALKPUSH_ACTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showWaitDuration && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Wait Config
            </p>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Duration
            </label>
            <Input
              value={data.data?.waitDuration ?? ""}
              onChange={(e) =>
                onDataChange(nodeId, { waitDuration: e.target.value })
              }
              placeholder="e.g. 3-5 business days"
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}

        {showTargetFolder && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Target Folder
            </label>
            <Input
              value={data.data?.targetFolder ?? ""}
              onChange={(e) =>
                onDataChange(nodeId, { targetFolder: e.target.value })
              }
              placeholder="e.g. Shortlisted, Interview"
              className="border border-gray-300 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}
      </div>

      {/* Delete button */}
      <div className="px-4 py-3 border-t border-gray-200 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(nodeId)}
          className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
