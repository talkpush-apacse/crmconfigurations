"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle2 } from "lucide-react";
import { generateCsvTemplate, parseCsv, downloadCsv } from "@/lib/csv-utils";
import type { ColumnDef } from "@/lib/types";

interface CsvToolbarProps {
  columns: ColumnDef[];
  sampleRow: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onImport: (rows: Record<string, any>[]) => void;
  sheetName: string;
}

export function CsvToolbar({ columns, sampleRow, onImport, sheetName }: CsvToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate(columns, sampleRow);
    const filename = `${sheetName.toLowerCase().replace(/\s+/g, "-")}-template.csv`;
    downloadCsv(csv, filename);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text, columns);

      if (rows.length === 0) {
        setImportStatus("No valid rows found in CSV");
      } else {
        onImport(rows);
        setImportStatus(`Imported ${rows.length} row${rows.length !== 1 ? "s" : ""}`);
      }
    } catch {
      setImportStatus("Error reading CSV file");
    }

    // Reset file input so same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Clear status after 3 seconds
    setTimeout(() => setImportStatus(null), 3000);
  };

  return (
    <div className="mb-3 flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadTemplate}
        className="text-xs"
      >
        <Download className="mr-1 h-3.5 w-3.5" />
        Download CSV Template
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUploadClick}
        className="text-xs"
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        Upload CSV
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      {importStatus && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {importStatus}
        </span>
      )}
    </div>
  );
}
