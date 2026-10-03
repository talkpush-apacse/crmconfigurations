"use client";

import { useState } from "react";
import { PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { useApiResource } from "@/lib/tracker/use-api-resource";

interface ConnectionDTO {
  id: string;
  email: string;
  appName: string;
  connectedAt: string;
  lastUsedAt: string | null;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function lastUsed(iso: string | null): string {
  if (!iso) return "Not used yet";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return dateFormat.format(new Date(iso));
}

export default function ConnectionsPage() {
  const { data, error, reload } = useApiResource<{ connections: ConnectionDTO[] }>("/api/mcp-connections");
  const connections = data?.connections ?? null;
  const [revoking, setRevoking] = useState<ConnectionDTO | null>(null);
  const [actionError, setActionError] = useState("");

  const revoke = async () => {
    if (!revoking) return;
    setActionError("");
    try {
      await api(`/api/mcp-connections/${revoking.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Connected apps"
        description="People who have connected Claude to the Talkpush CRM tools. Revoke a connection to switch it off straight away."
      />
      {actionError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : connections === null ? (
        <LoadingBlock label="Loading connected apps" />
      ) : connections.length === 0 ? (
        <EmptyState
          icon={PlugZap}
          title="No one has connected Claude yet"
          description="When a colleague adds the connector in Claude and clicks Allow, they will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>{c.appName}</TableCell>
                  <TableCell>{dateFormat.format(new Date(c.connectedAt))}</TableCell>
                  <TableCell>{lastUsed(c.lastUsedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRevoking(c)} aria-label={`Revoke ${c.email}'s connection from ${c.appName}`}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Connections made with a shared key (the older way) are not listed here. To switch those off, change the key in Vercel.
      </p>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke this connection?"
        description={revoking ? `${revoking.email}'s ${revoking.appName} will stop working straight away. They can connect again from Claude.` : ""}
        confirmLabel="Revoke"
        onConfirm={revoke}
      />
    </>
  );
}
