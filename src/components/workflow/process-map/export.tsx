"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { deriveFlowTable, flowTableCsv, type FlowTable } from "@/lib/workflow/process-map/flow-table";
import { buildScene, type Scene, type SceneMeta } from "@/lib/workflow/process-map/scene";
import { SceneSvg } from "./shapes";

/**
 * Downloads for a Process Map: SVG, PNG, PDF (through the browser's "Save as PDF") and the flow table as CSV.
 * Every one of them is made from the same scene the screen draws, so the file always matches what you saw.
 * Callers pass the page's steps as the client is allowed to see them, so a client download never contains staff-only content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ExportPage {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
}

export interface ExportMeta extends SceneMeta {
  /** Used in file names, for example "v3" or "Draft". */
  fileVersion: string;
}

const MAX_CANVAS = 16000;
const MAX_PAGE_PX = 19000; // browsers refuse printed pages larger than about 200 inches

export function sceneFor(page: ExportPage, meta: ExportMeta): Scene {
  return buildScene(page.nodes, page.edges, meta);
}

export function fileBase(meta: ExportMeta, pageName?: string, pageCount = 1): string {
  const parts = [meta.clientName, meta.workflowName].filter(Boolean).join(" ");
  const page = pageCount > 1 && pageName ? ` - ${pageName}` : "";
  return `${parts}${page} (${meta.fileVersion})`.replace(/[\\/:*?"<>|]+/g, "-");
}

/** The scene as a standalone SVG document string (selectable text, no external files). */
export function sceneToSvgString(scene: Scene): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(<SceneSvg scene={scene} />));
  const svg = host.innerHTML;
  root.unmount();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSvg(scene: Scene, name: string) {
  download(new Blob([sceneToSvgString(scene)], { type: "image/svg+xml;charset=utf-8" }), `${name}.svg`);
}

/** PNG at 1x, 2x or 3x. The scale is reduced when the picture would be bigger than a browser can draw. */
export async function downloadPng(scene: Scene, name: string, scale: 1 | 2 | 3 = 2): Promise<{ scale: number }> {
  const svg = sceneToSvgString(scene);
  const { w, h } = scene.bounds;
  const k = Math.max(0.1, Math.min(scale, MAX_CANVAS / w, MAX_CANVAS / h));
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not draw the picture."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw the picture.");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not make the picture.");
    download(blob, `${name}.png`);
    return { scale: k };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function tablesFor(pages: ExportPage[]): { page: ExportPage; table: FlowTable }[] {
  return pages.map((page) => ({ page, table: deriveFlowTable(page.nodes, page.edges) }));
}

export function downloadFlowTableCsv(pages: ExportPage[], name: string) {
  const tables = tablesFor(pages);
  const merged: FlowTable = { columns: tables[0]?.table.columns ?? [], rows: tables.flatMap((t) => t.table.rows), unusualActors: [] };
  download(new Blob([flowTableCsv(merged)], { type: "text/csv;charset=utf-8" }), `${name} - flow table.csv`);
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * PDF: opens a print view with one page per diagram, sized to the diagram (no shrinking to A4, so text stays
 * readable), then the flow table on A4 pages. Choose "Save as PDF" in the print window.
 * Returns false when the browser blocked the pop-up.
 */
export function printPdf(pages: ExportPage[], meta: ExportMeta, title: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const scenes = pages.map((p) => ({ page: p, scene: sceneFor(p, meta) }));
  const diagrams = scenes
    .map(({ scene }) => {
      const { w, h } = scene.bounds;
      const k = Math.min(1, MAX_PAGE_PX / w, MAX_PAGE_PX / h);
      const svg = sceneToSvgString(scene).replace(/^<\?xml[^>]*>\s*/, "").replace(/width="[\d.]+" height="[\d.]+"/, `width="${Math.round(w * k)}" height="${Math.round(h * k)}"`);
      return { w: Math.round(w * k), h: Math.round(h * k), svg };
    });
  const pageRules = diagrams.map((d, i) => `@page d${i} { size: ${d.w}px ${d.h}px; margin: 0 }`).join("\n");
  const diagramHtml = diagrams.map((d, i) => `<section class="diagram" style="page:d${i};width:${d.w}px;height:${d.h}px">${d.svg}</section>`).join("\n");
  const tableHtml = tablesFor(pages)
    .map(({ page, table }) => {
      const rows = table.rows.map((r) => `<tr><td class="n">${esc(r.stepDisplay)}</td><td>${esc(r.actor)}</td><td>${esc(r.action)}</td><td>${esc(r.actionType)}</td><td>${esc(r.branch)}</td></tr>`).join("");
      return `<section class="table"><h2>${esc(title)}${pages.length > 1 ? ` · ${esc(page.name)}` : ""} · flow table</h2><table><thead><tr>${table.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></section>`;
    })
    .join("\n");
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileBase(meta))}</title><style>
${pageRules}
@page tbl { size: A4 landscape; margin: 14mm }
html,body{margin:0;padding:0;font-family:"DM Sans",system-ui,sans-serif;color:#1a1a1a}
.diagram{break-after:page;overflow:hidden}
.diagram svg{display:block}
.table{page:tbl;break-before:page}
h2{font-size:14pt;margin:0 0 8mm}
table{border-collapse:collapse;width:100%;font-size:9pt}
th,td{border:1px solid #333;padding:4px 6px;vertical-align:top;text-align:left}
th{background:#eceff1}
td.n{white-space:nowrap;font-weight:700}
tr{break-inside:avoid}
</style></head><body>${diagramHtml}${tableHtml}<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script></body></html>`);
  win.document.close();
  return true;
}
