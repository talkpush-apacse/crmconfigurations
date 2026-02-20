"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink, Trash2, Copy, Download, Settings, Search, CheckCircle, X } from "lucide-react";
import { TabSelector } from "@/components/admin/TabSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels } from "@/lib/template-data";
import type { CommunicationChannels } from "@/lib/types";

interface ChecklistSummary {
  id: string;
  slug: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  enabledTabs: string[] | null;
  communicationChannels: CommunicationChannels | null;
}

interface EditingState {
  id: string;
  clientName: string;
  tabs: string[];
  channels: CommunicationChannels;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard | Talkpush CRM";
  }, []);

  const fetchChecklists = async () => {
    try {
      const res = await fetch("/api/checklists");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load checklists");
        setChecklists([]);
        return;
      }
      if (!Array.isArray(data)) {
        setError("Unexpected response from server");
        setChecklists([]);
        return;
      }
      setError("");
      setChecklists(data);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (id: string) => setDeletingId(id);

  const handleConfirmDelete = async (id: string) => {
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchChecklists();
  };

  const handleCopy = async (id: string) => {
    try {
      const res = await fetch(`/api/checklists/${id}`);
      const original = await res.json();
      const newName = `${original.clientName} (Copy)`;

      const createRes = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: newName,
          enabledTabs: original.enabledTabs,
          communicationChannels: original.communicationChannels,
        }),
      });
      const created = await createRes.json();
      fetchChecklists();
      setCopySuccess(created.slug || newName);
      setTimeout(() => setCopySuccess(null), 4000);
    } catch {
      console.error("Failed to copy checklist");
    }
  };

  const handleEditSettings = (c: ChecklistSummary) => {
    setEditing({
      id: c.id,
      clientName: c.clientName,
      tabs: c.enabledTabs || getAllSelectableTabSlugs(),
      channels: (c.communicationChannels as CommunicationChannels) || defaultCommunicationChannels,
    });
  };

  // Sync AI Calls channel ↔ AI Call tab in edit modal
  const handleEditChannelsChange = useCallback((newChannels: CommunicationChannels) => {
    setEditing((prev) => {
      if (!prev) return prev;
      let newTabs = [...prev.tabs];
      if (newChannels.aiCalls && !newTabs.includes("ai-call-faqs")) {
        newTabs = [...newTabs, "ai-call-faqs"];
      } else if (!newChannels.aiCalls && newTabs.includes("ai-call-faqs")) {
        newTabs = newTabs.filter((t) => t !== "ai-call-faqs");
      }
      return { ...prev, channels: newChannels, tabs: newTabs };
    });
  }, []);

  const handleEditTabsChange = useCallback((newTabs: string[]) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const aiTabEnabled = newTabs.includes("ai-call-faqs");
      const newChannels = aiTabEnabled !== prev.channels.aiCalls
        ? { ...prev.channels, aiCalls: aiTabEnabled }
        : prev.channels;
      return { ...prev, tabs: newTabs, channels: newChannels };
    });
  }, []);

  const handleSaveSettings = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/checklists/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledTabs: editing.tabs,
          communicationChannels: editing.channels,
        }),
      });
      setEditing(null);
      fetchChecklists();
    } catch {
      console.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM Config Checklists</h1>
            <p className="text-sm text-muted-foreground">Manage client configuration checklists</p>
          </div>
          <Link href="/admin/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Checklist
            </Button>
          </Link>
        </div>

        {/* Edit Settings Dialog (Channels + Tabs) */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="text-base">
                  Settings — {editing.clientName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ChannelSelector
                  channels={editing.channels}
                  onChange={handleEditChannelsChange}
                />
                <TabSelector
                  selectedTabs={editing.tabs}
                  onChange={handleEditTabsChange}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Copy success notification */}
        {copySuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700">
              Checklist copied!{" "}
              <Link href={`/client/${copySuccess}`} target="_blank" className="font-medium underline">
                Open copy
              </Link>
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">All Checklists ({checklists.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading...</p>
            ) : checklists.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No checklists yet.</p>
                <Link href="/admin/new">
                  <Button variant="outline" className="mt-4">
                    Create your first checklist
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists
                    .filter((c) => !searchQuery || c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || c.slug.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/client/${c.slug}`}
                          target="_blank"
                          className="hover:underline hover:text-primary transition-colors"
                        >
                          {c.clientName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/client/${c.slug}`} target="_blank">
                                <Button variant="ghost" size="icon">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Open checklist</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={`/api/export/${c.slug}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Export to XLS</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditSettings(c)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit settings</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopy(c.id)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Duplicate checklist</TooltipContent>
                          </Tooltip>

                          {deletingId === c.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive hover:text-white"
                                onClick={() => handleConfirmDelete(c.id)}
                              >
                                Delete?
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => setDeletingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleDelete(c.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete checklist</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
