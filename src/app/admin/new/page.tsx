"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewChecklistPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName }),
      });

      if (!res.ok) {
        let errorMsg = "Failed to create checklist";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response body may be empty or invalid JSON
        }
        throw new Error(errorMsg);
      }

      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg p-6">
        <Link href="/admin" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to dashboard
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create New Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  required
                />
              </div>
              {slug && (
                <div className="rounded-lg bg-gray-100 p-3">
                  <p className="text-xs text-muted-foreground">Client URL will be:</p>
                  <p className="mt-1 font-mono text-sm">/client/{slug}</p>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !clientName.trim()}>
                {loading ? "Creating..." : "Create Checklist"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
