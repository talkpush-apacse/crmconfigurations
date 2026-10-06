"use client";

import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PRINT_VIEW_LABEL, type PrintView } from "./print/PrintReport";

interface Props {
  /** The tab being looked at. */
  view: PrintView;
  busy: boolean;
  onPdf: () => void;
  onXlsx: () => void;
  /** The whole project as one Excel file (Summary, List, Board, Timeline). */
  onWorkbook: () => void;
}

/** "Export" in the project header: a PDF of the tab you are on and, on the List tab, an Excel file too. */
export function ExportMenu({ view, busy, onPdf, onXlsx, onWorkbook }: Props) {
  const label = PRINT_VIEW_LABEL[view];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {busy ? "Preparing" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Exports what the {label} tab shows right now</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onPdf} className="cursor-pointer">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>
            Download {label} as PDF
            <span className="block text-xs text-muted-foreground">Choose &ldquo;Save as PDF&rdquo; in the print window</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onWorkbook} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          <span>
            Download all views as Excel
            <span className="block text-xs text-muted-foreground">One file: Summary, List, Board, Timeline</span>
          </span>
        </DropdownMenuItem>
        {view === "list" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onXlsx} className="cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              <span>
                Download this List as Excel
                <span className="block text-xs text-muted-foreground">Only the items and filters shown now</span>
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
