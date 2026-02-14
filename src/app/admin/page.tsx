"use client";

import { useState, useEffect } from "react";
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
import { Plus, ExternalLink, Trash2, Copy, Download } from "lucide-react";

interface ChecklistSummary {
  id: string;
  slug: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChecklists = async () => {
    try {
      const res = await fetch("/api/checklists");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setChecklists(data);
    } catch {
      console.error("Failed to fetch checklists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete checklist "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    fetchChecklists();
  };

  const handleCopy = async (id: string) => {
    try {
      const res = await fetch(`/api/checklists/${id}`);
      const original = await res.json();
      const newName = `${original.clientName} (Copy)`;

      await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: newName }),
      });
      fetchChecklists();
    } catch {
      console.error("Failed to copy checklist");
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Checklists ({checklists.length})</CardTitle>
          </CardHeader>
          <CardContent>
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
                  {checklists.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/client/${c.slug}`} target="_blank">
                            <Button variant="ghost" size="icon" title="Open checklist">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                          <a href={`/api/export/${c.slug}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" title="Export XLS">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copy checklist"
                            onClick={() => handleCopy(c.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            title="Delete checklist"
                            onClick={() => handleDelete(c.id, c.clientName)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
