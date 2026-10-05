"use client";

import { Download, FileImage, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/workflow/ui/toast";
import { downloadFlowTableCsv, downloadPng, downloadSvg, fileBase, printPdf, sceneFor, type ExportMeta, type ExportPage } from "./export";

/**
 * The download items on their own, so the editor can place them inside its Export menu.
 * `pages` must already be limited to what the viewer may see.
 */
export function DownloadMenuItems({ pages, activePageId, meta }: { pages: ExportPage[]; activePageId: string | null; meta: ExportMeta }) {
  const page = pages.find((p) => p.id === activePageId) ?? pages[0];
  if (!page) return null;
  const name = fileBase(meta, page.name, pages.length);

  async function png(scale: 1 | 2 | 3) {
    try {
      const out = await downloadPng(sceneFor(page, meta), name, scale);
      if (out.scale < scale) toast.info(`The diagram is very large, so the picture was saved at ${out.scale.toFixed(1)}×.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the picture.");
    }
  }

  return (
    <>
      <DropdownMenuItem
        className="cursor-pointer gap-2"
        onClick={() => {
          if (!printPdf(pages, meta, `${meta.clientName} ${meta.workflowName}`)) toast.error("Your browser blocked the print window. Allow pop-ups and try again.");
        }}
      >
        <FileText className="h-3.5 w-3.5" />PDF (diagram + flow table)
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => downloadSvg(sceneFor(page, meta), name)}>
        <FileImage className="h-3.5 w-3.5" />SVG (sharp at any size)
      </DropdownMenuItem>
      {([1, 2, 3] as const).map((k) => (
        <DropdownMenuItem key={k} className="cursor-pointer gap-2" onClick={() => png(k)}>
          <ImageIcon className="h-3.5 w-3.5" />PNG at {k}×
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => downloadFlowTableCsv(pages, fileBase(meta))}>
        <FileSpreadsheet className="h-3.5 w-3.5" />Flow table (CSV for Excel)
      </DropdownMenuItem>
    </>
  );
}

/** Download menu for a Process Map. `pages` must already be limited to what the viewer may see. */
export default function DownloadMenu({
  pages,
  activePageId,
  meta,
  variant = "outline",
}: {
  pages: ExportPage[];
  activePageId: string | null;
  meta: ExportMeta;
  variant?: "outline" | "ghost";
}) {
  if (!(pages.find((p) => p.id === activePageId) ?? pages[0])) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="min-h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DownloadMenuItems pages={pages} activePageId={activePageId} meta={meta} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
