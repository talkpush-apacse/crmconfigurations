"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Layers3,
  ListChecks,
  Loader2,
  Search,
  TableProperties,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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

interface ApplyRequirementsTemplateSheetProps {
  checklistId: string;
  clientName: string;
}

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

function fieldTypeLabel(type: string) {
  if (type === "textarea") return "Long text";
  if (type === "repeater") return "Repeater";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ApplyRequirementsTemplateSheet({
  checklistId,
  clientName,
}: ApplyRequirementsTemplateSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateWithSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tabNameOverride, setTabNameOverride] = useState("");
  const [descriptionOverride, setDescriptionOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates.length > 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/requirements-templates")
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
        setSelectedId((current) => current ?? nextTemplates[0]?.id ?? null);
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
  }, [open, templates.length]);

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

  useEffect(() => {
    if (!selected) return;
    setTabNameOverride(selected.tabName);
    setDescriptionOverride(selected.tabDescription ?? "");
  }, [selected?.id]);

  const handleApply = async () => {
    if (!selected || applying) return;

    setApplying(true);
    setError(null);
    try {
      const response = await fetch(`/api/checklists/${checklistId}/requirements-templates/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          tabNameOverride,
          descriptionOverride,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Failed to apply template.");
      }

      setOpen(false);
      router.push(`/admin/checklists/${checklistId}/${body.appliedTab.urlSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="shrink-0">
          <ClipboardList className="h-4 w-4" />
          Apply template
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">Apply requirements template</SheetTitle>
          <SheetDescription>
            Add a client-facing requirements form to {clientName}. The new tab is a snapshot, so later template edits will not change it.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
          <div className="border-b bg-muted/30 p-4 lg:border-r lg:border-b-0">
            <Label htmlFor="template-search" className="text-xs font-medium text-muted-foreground">
              Search templates
            </Label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="template-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Referral, AI, ATS..."
              />
            </div>

            <ScrollArea className="mt-4 h-[260px] lg:h-[calc(100vh-260px)]">
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  No active templates match that search.
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {filteredTemplates.map((template) => {
                    const summary = summaryFor(template);
                    const selectedTemplate = selected?.id === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedId(template.id)}
                        className={cn(
                          "w-full rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selectedTemplate && "border-primary/60 bg-primary/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{template.name}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {template.category ?? "Requirements"}
                            </p>
                          </div>
                          {selectedTemplate && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{summary.fieldCount} fields</span>
                          <span aria-hidden="true">·</span>
                          <span>{summary.attachmentFieldCount} files</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="min-h-0 p-5">
            {selected && selectedSummary ? (
              <ScrollArea className="h-[calc(100vh-190px)] pr-3">
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight">{selected.name}</h2>
                      <Badge variant="outline">v{selected.version}</Badge>
                      {selected.category && <Badge variant="secondary">{selected.category}</Badge>}
                    </div>
                    {selected.description && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {selected.description}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
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
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-tab-name">Tab name</Label>
                      <Input
                        id="template-tab-name"
                        value={tabNameOverride}
                        onChange={(event) => setTabNameOverride(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-tab-description">Client-facing description</Label>
                      <Textarea
                        id="template-tab-description"
                        value={descriptionOverride}
                        onChange={(event) => setDescriptionOverride(event.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">Form schema</h3>
                    <div className="mt-3 divide-y rounded-lg border">
                      {selected.fields.map((field) => (
                        <div key={field.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {field.label}
                              {(field.required || field.requiredWhen) && (
                                <span className="ml-1 text-destructive">*</span>
                              )}
                            </p>
                            {field.helpText && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {field.helpText}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-start gap-1.5 sm:justify-end">
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
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Select a template to preview it.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="border-t border-destructive/20 bg-destructive/10 px-6 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <SheetFooter className="border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Applying creates a new custom requirements tab. Existing tabs and responses stay untouched.
          </p>
          <Button onClick={handleApply} disabled={!selected || applying || !tabNameOverride.trim()}>
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying
              </>
            ) : (
              <>
                Apply to checklist
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
