"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TabSelector } from "@/components/admin/TabSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels } from "@/lib/template-data";
import type { CommunicationChannels } from "@/lib/types";

export default function NewChecklistPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [enabledTabs, setEnabledTabs] = useState<string[]>(getAllSelectableTabSlugs());
  const [channels, setChannels] = useState<CommunicationChannels>(defaultCommunicationChannels);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Sync AI Calls channel ↔ AI Call tab
  const handleChannelsChange = useCallback((newChannels: CommunicationChannels) => {
    setChannels(newChannels);
    // Auto-sync: AI Calls channel → AI Call tab
    if (newChannels.aiCalls && !enabledTabs.includes("ai-call-faqs")) {
      setEnabledTabs((prev) => [...prev, "ai-call-faqs"]);
    } else if (!newChannels.aiCalls && enabledTabs.includes("ai-call-faqs")) {
      setEnabledTabs((prev) => prev.filter((t) => t !== "ai-call-faqs"));
    }
  }, [enabledTabs]);

  const handleTabsChange = useCallback((newTabs: string[]) => {
    setEnabledTabs(newTabs);
    // Auto-sync: AI Call tab → AI Calls channel
    const aiTabEnabled = newTabs.includes("ai-call-faqs");
    if (aiTabEnabled !== channels.aiCalls) {
      setChannels((prev) => ({ ...prev, aiCalls: aiTabEnabled }));
    }
  }, [channels.aiCalls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, enabledTabs, communicationChannels: channels }),
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
      <div className="mx-auto max-w-2xl p-6">
        <Link href="/admin" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to dashboard
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create New Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <ChannelSelector channels={channels} onChange={handleChannelsChange} />

              <TabSelector selectedTabs={enabledTabs} onChange={handleTabsChange} />

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
