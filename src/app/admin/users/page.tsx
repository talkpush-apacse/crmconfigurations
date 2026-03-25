"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Pencil,
  FolderOpen,
  Users as UsersIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { Role } from "@/lib/types";

interface UserItem {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  assignmentCount: number;
}

interface ChecklistOption {
  id: string;
  slug: string;
  clientName: string;
}

interface AssignmentItem {
  checklistId: string;
  slug: string;
  clientName: string;
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  EDITOR: "bg-blue-100 text-blue-700 border-blue-200",
  VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create user dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("EDITOR");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit role dialog
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<Role>("EDITOR");
  const [savingRole, setSavingRole] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Assignments dialog
  const [assigningUser, setAssigningUser] = useState<UserItem | null>(null);
  const [allChecklists, setAllChecklists] = useState<ChecklistOption[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<AssignmentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingAssignments, setSavingAssignments] = useState(false);

  useEffect(() => {
    document.title = "User Management | Talkpush CRM";
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.status === 403) { router.push("/admin"); return; }
      const data = await res.json();
      setUsers(data.items || []);
      setError("");
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create user"); return; }
      setShowCreate(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("EDITOR");
      fetchUsers();
    } catch {
      setCreateError("Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    setSavingRole(true);
    try {
      await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      setEditingUser(null);
      fetchUsers();
    } catch {
      console.error("Failed to update role");
    } finally {
      setSavingRole(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      console.error("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const openAssignments = async (user: UserItem) => {
    setAssigningUser(user);
    setSavingAssignments(false);

    // Fetch all checklists and current assignments in parallel
    const [checklistsRes, assignmentsRes] = await Promise.all([
      fetch("/api/checklists?page=1"),
      fetch(`/api/users/${user.id}/assignments`),
    ]);
    const checklistsData = await checklistsRes.json();
    const assignmentsData = await assignmentsRes.json();

    const checklists: ChecklistOption[] = (checklistsData.items || []).map((c: ChecklistOption) => ({
      id: c.id,
      slug: c.slug,
      clientName: c.clientName,
    }));
    setAllChecklists(checklists);

    const assignments: AssignmentItem[] = assignmentsData.items || [];
    setCurrentAssignments(assignments);

    const assignedIds = new Set(assignments.map((a: AssignmentItem) => a.checklistId));
    setSelectedIds(assignedIds);
  };

  const handleSaveAssignments = async () => {
    if (!assigningUser) return;
    setSavingAssignments(true);

    const currentIds = new Set(currentAssignments.map((a) => a.checklistId));
    const toAdd = [...selectedIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !selectedIds.has(id));

    try {
      const promises: Promise<Response>[] = [];
      if (toAdd.length > 0) {
        promises.push(
          fetch(`/api/users/${assigningUser.id}/assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checklistIds: toAdd }),
          })
        );
      }
      if (toRemove.length > 0) {
        promises.push(
          fetch(`/api/users/${assigningUser.id}/assignments`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checklistIds: toRemove }),
          })
        );
      }
      await Promise.all(promises);
      setAssigningUser(null);
      fetchUsers();
    } catch {
      console.error("Failed to save assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  const toggleChecklist = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-4xl p-6">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-sm text-muted-foreground">
                  Create users and assign checklists
                </p>
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center">
                <UsersIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">No users yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your first team member to get started.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-white shadow-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROLE_COLORS[user.role]}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {user.role === "ADMIN" ? "All" : `${user.assignmentCount} checklist${user.assignmentCount !== 1 ? "s" : ""}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {user.role !== "ADMIN" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openAssignments(user)}
                                    aria-label="Manage assignments"
                                  >
                                    <FolderOpen className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assign checklists</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setEditingUser(user); setEditRole(user.role); }}
                                  aria-label="Edit role"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit role</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget(user)}
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new team member account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Password *</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Role *</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin — Full access</SelectItem>
                  <SelectItem value="EDITOR">Editor — Edit assigned checklists</SelectItem>
                  <SelectItem value="VIEWER">Viewer — View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newEmail || !newPassword}
            >
              {creating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Change role for {editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={savingRole}>
              {savingRole ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.email}</strong>? This will also remove all their checklist assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Dialog */}
      <Dialog open={!!assigningUser} onOpenChange={() => setAssigningUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Checklists</DialogTitle>
            <DialogDescription>
              Select which checklists <strong>{assigningUser?.email}</strong> can access.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-2 py-2">
            {allChecklists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No checklists available</p>
            ) : (
              allChecklists.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleChecklist(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.clientName}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningUser(null)}>Cancel</Button>
            <Button onClick={handleSaveAssignments} disabled={savingAssignments}>
              {savingAssignments ? "Saving..." : `Save (${selectedIds.size} selected)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
