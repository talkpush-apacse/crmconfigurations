"use client";

import { useState } from "react";
import { Send, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { Field, FormError } from "@/components/tracker/Field";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, SUPER_ADMIN_DESCRIPTION, SUPER_ADMIN_LABEL, type Role } from "@/lib/roles";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { InvitationOutcome } from "@/lib/invitation-email";
import { isTalkpushEmail } from "@/lib/users-rules";
import type { UserDTO } from "@/lib/users-service";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function UsersPage() {
  const { data, error, reload } = useApiResource<{ users: UserDTO[]; signInUrl: string }>("/api/users");
  const users = data?.users ?? null;
  // Only a super admin sees the super admin controls; the server refuses anyone else whatever the screen shows.
  const iAmSuperAdmin = users?.find((u) => u.isYou)?.isSuperAdmin === true;
  const signInUrl = data?.signInUrl ?? "";
  const [notice, setNotice] = useState<{ email: string; invitation: InvitationOutcome; resent: boolean } | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<UserDTO | null>(null);
  const [actionError, setActionError] = useState("");

  const changeRole = async (user: UserDTO, role: Role) => {
    setActionError("");
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: { role } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
    reload();
  };

  const changeSuperAdmin = async (user: UserDTO, isSuperAdmin: boolean) => {
    setActionError("");
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: { isSuperAdmin } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
    reload();
  };

  const resendInvitation = async (user: UserDTO) => {
    setActionError("");
    setResending(user.id);
    try {
      const result = await api<{ invitation: InvitationOutcome }>(`/api/users/${user.id}/invite`, { method: "POST" });
      setNotice({ email: user.email, invitation: result.invitation, resent: true });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setResending(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setActionError("");
    try {
      await api(`/api/users/${removing.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in to the Talkpush Implementation Hub, and what they can do."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      <dl className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r}>
            <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
            <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="font-semibold">{SUPER_ADMIN_LABEL}</dt>
          <dd className="text-muted-foreground">{SUPER_ADMIN_DESCRIPTION}</dd>
        </div>
      </dl>

      {notice && (
        <div role="status" className="mb-4 rounded-xl border border-border bg-card p-4 text-sm">
          {notice.invitation.status === "sent" ? (
            <>
              <p className="font-medium">{notice.resent ? `Invitation sent again to ${notice.email}.` : `${notice.email} can now sign in, and we emailed them an invitation.`}</p>
              <p className="mt-1 text-muted-foreground">
                The email has the link and the steps. If they cannot find it, ask them to check spam, or use <strong className="text-foreground">Resend invitation</strong> under their name in the list.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">
                {notice.invitation.status === "failed"
                  ? `${notice.email} can sign in, but the invitation email could not be sent.`
                  : `${notice.email} can now sign in. No email was sent because it is not a talkpush.com address.`}
              </p>
              <p className="mt-1 text-muted-foreground">
                Tell them to open <strong className="text-foreground">{signInUrl || "the Hub"}</strong>, click <strong className="text-foreground">Sign in with Google</strong>, and
                choose the Google account for {notice.email}. It has to be that exact email, and a talkpush.com Google account.
                {notice.invitation.status === "failed" && notice.email && isTalkpushEmail(notice.email) && " You can also try Resend invitation in the list."}
              </p>
            </>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : users === null ? (
        <LoadingBlock label="Loading users" />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Add the first user to give someone access." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Signs in with</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.email}
                    {u.isYou && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">You</span>}
                    {u.isSuperAdmin && <span className="ml-2 rounded border border-border bg-secondary px-1.5 py-0.5 text-xs font-medium">{SUPER_ADMIN_LABEL}</span>}
                    {!isTalkpushEmail(u.email) && (
                      <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground" title="This address is not a talkpush.com address">
                        Outside Talkpush
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {u.isYou || (u.isSuperAdmin && !iAmSuperAdmin) ? (
                        ROLE_LABELS[u.role]
                      ) : (
                        <Select value={u.role} onValueChange={(v) => void changeRole(u, v as Role)}>
                          <SelectTrigger aria-label={`Role for ${u.email}`} className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {iAmSuperAdmin && u.role === "editor" && (
                        <button
                          type="button"
                          className="block min-h-6 text-xs font-medium text-primary underline underline-offset-4"
                          onClick={() => void changeSuperAdmin(u, !u.isSuperAdmin)}
                          aria-label={`${u.isSuperAdmin ? "Remove super admin from" : "Make super admin"} ${u.email}`}
                        >
                          {u.isSuperAdmin ? "Remove super admin" : "Make super admin"}
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.signIn}
                    {u.signIn === "Not signed in yet" && isTalkpushEmail(u.email) && (
                      <button
                        type="button"
                        onClick={() => void resendInvitation(u)}
                        disabled={resending !== null}
                        aria-label={`Resend invitation to ${u.email}`}
                        title="Email them the invitation again"
                        className="mt-1 flex min-h-6 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />
                        {resending === u.id ? "Sending..." : "Resend invitation"}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{dateFormat.format(new Date(u.createdAt))}</TableCell>
                  <TableCell className="text-right">
                    {!u.isYou && (!u.isSuperAdmin || iAmSuperAdmin) && (
                      <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRemoving(u)} aria-label={`Remove ${u.email}`}>
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        A role change takes effect within seconds, including for Claude connections the person has made. People you add get an invitation email and sign in with
        Google, using the same email. You cannot change or remove your own login. There must always be at least one Talkpush Admin and one super admin, and only a super admin can change a super admin.
      </p>

      <AddUserDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={(email, invitation) => {
          setNotice({ email, invitation, resent: false });
          reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this user?"
        description={
          removing
            ? `${removing.email} will no longer be able to sign in, and any Claude connection they made stops working straight away. You can add them again later.`
            : ""
        }
        confirmLabel="Remove user"
        onConfirm={remove}
      />
    </>
  );
}

function AddUserDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (email: string, invitation: InvitationOutcome) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setEmail("");
      setRole("viewer");
      setError("");
    }
    onOpenChange(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api<UserDTO & { invitation: InvitationOutcome }>("/api/users", { method: "POST", body: { email, role } });
      onAdded(created.email, created.invitation);
      close(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const outside = email.includes("@") && !isTalkpushEmail(email);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>They sign in with Google using this email, and we email them the link. No password is needed.</DialogDescription>
          </DialogHeader>
          <Field label="Email" htmlFor="user-email" required>
            <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus maxLength={200} autoComplete="off" />
          </Field>
          {outside && <p className="text-xs text-muted-foreground">This is not a talkpush.com address. No invitation email is sent to outside addresses. Only add people you trust with Talkpush client data.</p>}
          <Field label="Role" htmlFor="user-role" hint={ROLE_DESCRIPTIONS[role]}>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || email.trim() === ""}>
              {saving ? "Adding..." : outside ? "Add user" : "Add and send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
