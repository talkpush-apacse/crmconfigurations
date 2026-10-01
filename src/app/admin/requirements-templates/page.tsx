"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ClipboardList,
  FileUp,
  Layers3,
  LibraryBig,
  ListChecks,
  Loader2,
  Search,
  TableProperties,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { RequirementsTemplate } from "@/lib/types";

interface TemplateSummary {
  fieldCount: number;
  requiredFieldCount: number;
  attachmentFieldCount: number;
  repeaterFieldCount: number;
  validationGroupCount: number;
}

type TemplateWithSummary = RequirementsTemplate & { summary?: TemplateSummary };

function summaryFor(template: TemplateWithSummary): TemplateSummary {
  if (template.summary) return template.summary;
  return {
    fieldCount: template.fields.length,
    requiredFieldCount: template.fields.filter((field) => field.required || field.requiredWhen).length,
    attachmentFieldCount: template.fields.filter((field) => field.type === "file").length,
    repeaterFieldCount: template.fields.filter((field) => field.type === "repeater").length,
    validationGroupCount: template.validationGroups?.length ?? 0,
  };
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fieldTypeLabel(type: string) {
  if (type === "textarea") return "Long text";
  if (type === "repeater") return "Repeater";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function RequirementsTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/requirements-templates?includeArchived=${includeArchived ? "true" : "false"}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load templates.");
        }
        return response.json();
      })
      .then((body) => {
        if (cancelled) return;
        const nextTemplates = (body.templates ?? []) as TemplateWithSummary[];
        setTemplates(nextTemplates);
        setSelectedId((current) => {
          if (current && nextTemplates.some((template) => template.id === current)) return current;
          return nextTemplates[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [includeArchived]);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((template) =>
      [template.name, template.category, template.description, template.tabName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [query, templates]);

  const selected = templates.find((template) => template.id === selectedId) ?? filteredTemplates[0] ?? null;
  const selectedSummary = selected ? summaryFor(selected) : null;

  const aggregate = useMemo(() => {
    return templates.reduce(
      (acc, template) => {
        const summary = summaryFor(template);
        acc.fields += summary.fieldCount;
        acc.uploads += summary.attachmentFieldCount;
        acc.validationGroups += summary.validationGroupCount;
        return acc;
      },
      { fields: 0, uploads: 0, validationGroups: 0 },
    );
  }, [templates]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LibraryBig className="h-5 w-5" />
                  </span>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Requirements Templates
                  </h1>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review reusable questionnaire templates before applying them to client checklists.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/admin">
                  <ClipboardList className="h-4 w-4" />
                  Back to checklists
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <ListChecks className="h-4 w-4 text-primary" />
                    Active templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="text-2xl font-semibold tabular-nums">
                    {templates.filter((template) => !template.archived).length}
                  </p>
                </CardContent>
              </Card>
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Layers3 className="h-4 w-4 text-primary" />
                    Schema fields
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="text-2xl font-semibold tabular-nums">{aggregate.fields}</p>
                </CardContent>
              </Card>
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <FileUp className="h-4 w-4 text-primary" />
                    Upload prompts
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="text-2xl font-semibold tabular-nums">{aggregate.uploads}</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid min-h-[640px] gap-5 lg:grid-cols-[360px_1fr]">
              <Card className="gap-0 overflow-hidden py-0">
                <div className="border-b p-4">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="template-library-search">
                    Search library
                  </label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="template-library-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="AI interview, referral, ATS..."
                      className="pl-9"
                    />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(event) => setIncludeArchived(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Include archived templates
                  </label>
                </div>

                <ScrollArea className="h-[540px]">
                  {loading ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading templates
                    </div>
                  ) : error ? (
                    <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="m-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No templates match your search.
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {filteredTemplates.map((template) => {
                        const summary = summaryFor(template);
                        const isSelected = selected?.id === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedId(template.id)}
                            className={cn(
                              "w-full rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected && "border-primary/60 bg-primary/10",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{template.name}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {template.category ?? "Requirements"}
                                </p>
                              </div>
                              {template.archived && (
                                <Badge variant="outline" className="gap-1">
                                  <Archive className="h-3 w-3" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{summary.fieldCount} fields</span>
                              <span>{summary.requiredFieldCount} required</span>
                              <span>{summary.attachmentFieldCount} uploads</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </Card>

              <Card className="gap-0 overflow-hidden py-0">
                {selected && selectedSummary ? (
                  <>
                    <div className="border-b p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight">{selected.name}</h2>
                        <Badge variant="outline">v{selected.version}</Badge>
                        {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
                        {selected.archived && <Badge variant="outline">Archived</Badge>}
                      </div>
                      {selected.description && (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                          {selected.description}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        Last updated {formatDate(selected.updatedAt)}
                      </p>
                    </div>

                    <div className="grid gap-3 border-b p-5 sm:grid-cols-5">
                      <div className="rounded-lg border bg-background p-3">
                        <ListChecks className="h-4 w-4 text-primary" />
                        <p className="mt-2 text-lg font-semibold tabular-nums">{selectedSummary.fieldCount}</p>
                        <p className="text-xs text-muted-foreground">Fields</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <Layers3 className="h-4 w-4 text-primary" />
                        <p className="mt-2 text-lg font-semibold tabular-nums">{selectedSummary.requiredFieldCount}</p>
                        <p className="text-xs text-muted-foreground">Required</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <FileUp className="h-4 w-4 text-primary" />
                        <p className="mt-2 text-lg font-semibold tabular-nums">{selectedSummary.attachmentFieldCount}</p>
                        <p className="text-xs text-muted-foreground">Uploads</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <TableProperties className="h-4 w-4 text-primary" />
                        <p className="mt-2 text-lg font-semibold tabular-nums">{selectedSummary.repeaterFieldCount}</p>
                        <p className="text-xs text-muted-foreground">Repeaters</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <p className="mt-2 text-lg font-semibold tabular-nums">{selectedSummary.validationGroupCount}</p>
                        <p className="text-xs text-muted-foreground">Rules</p>
                      </div>
                    </div>

                    <ScrollArea className="h-[420px]">
                      <div className="p-5">
                        <h3 className="text-sm font-semibold">Client form fields</h3>
                        <div className="mt-3 divide-y rounded-lg border">
                          {selected.fields.map((field) => (
                            <div key={field.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {field.label}
                                  {(field.required || field.requiredWhen) && (
                                    <span className="ml-1 text-destructive">*</span>
                                  )}
                                </p>
                                {field.helpText && (
                                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                                    {field.helpText}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 md:justify-end">
                                <Badge variant="outline">{fieldTypeLabel(field.type)}</Badge>
                                {field.type === "file" && field.maxFileSizeMb && (
                                  <Badge variant="ghost">{field.maxFileSizeMb} MB</Badge>
                                )}
                                {field.type === "select" && field.options && (
                                  <Badge variant="ghost">{field.options.length} options</Badge>
                                )}
                                {field.type === "repeater" && field.columns && (
                                  <Badge variant="ghost">{field.columns.length} columns</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex h-full min-h-[560px] items-center justify-center p-6 text-sm text-muted-foreground">
                    Select a template to preview its schema.
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
