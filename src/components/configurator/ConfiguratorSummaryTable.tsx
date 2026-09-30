"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildConfiguratorSummaryRows } from "@/lib/configurator-summary";

interface ConfiguratorSummaryTableProps {
  sourceData: unknown;
  onExport: () => Promise<void>;
  exporting: boolean;
}

export function ConfiguratorSummaryTable({ sourceData, onExport, exporting }: ConfiguratorSummaryTableProps) {
  const rows = buildConfiguratorSummaryRows(sourceData);
  if (rows.length === 0) return null;

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Checklist Summary</CardTitle>
        <Button
          type="button"
          size="sm"
          onClick={onExport}
          disabled={exporting}
          className="rounded-md bg-emerald-800 text-white hover:bg-emerald-900"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Preparing..." : "Export Steps as Spreadsheet"}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-3 p-4 md:hidden">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Step {index + 1}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{row.path}</p>
                </div>
                <Badge className="shrink-0 rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                  {row.testerPerspective}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-slate-700">{row.action}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                {row.module}
              </p>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-12 text-xs uppercase tracking-wide">#</TableHead>
                <TableHead className="w-44 text-xs uppercase tracking-wide">Path</TableHead>
                <TableHead className="w-36 text-xs uppercase tracking-wide">Tester Perspective</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Action</TableHead>
                <TableHead className="w-40 text-xs uppercase tracking-wide">Module</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold tabular-nums text-slate-600">
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm leading-5 text-slate-600">{row.path}</TableCell>
                  <TableCell className="py-3">
                    <Badge className="rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                      {row.testerPerspective}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm leading-6 text-slate-700">
                    <span className="block whitespace-normal break-words">{row.action}</span>
                  </TableCell>
                  <TableCell className="py-3 text-sm font-medium leading-5 text-slate-600">{row.module}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
