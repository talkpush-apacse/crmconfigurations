"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, LayoutList, Settings2 } from "lucide-react";
import Link from "next/link";
import { TabSelector } from "@/components/admin/TabSelector";
import { ChannelSelector } from "@/components/admin/ChannelSelector";
import { CustomFieldBuilder } from "@/components/admin/CustomFieldBuilder";
import { getAllSelectableTabSlugs } from "@/lib/tab-config";
import { defaultCommunicationChannels, defaultFeatureToggles } from "@/lib/template-data";
import type { CommunicationChannels, FeatureToggles, CustomFieldDef } from "@/lib/types";

export default function NewChecklistPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customSchema, setCustomSchema] = useState<CustomFieldDef[]>([]);
  const [enabledTabs, setEnabledTabs] = useState<string[]>(getAllSelectableTabSlugs());
  const [channels, setChannels] = useState<CommunicationChannels>(defaultCommunicationChannels);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(defaultFeatureToggles);
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
      const body: Record<string, unknown> = { clientName };

      if (isCustom) {
        body.isCustom = true;
        body.customSchema = customSchema;
      } else {
        body.enabledTabs = enabledTabs;
        body.communicationChannels = channels;
        body.featureToggles = featureToggles;
      }

      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

              {/* Checklist mode toggle */}
              <div>
                <Label className="mb-2 block text-sm font-medium">Checklist Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCustom(false)}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                      !isCustom
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 text-muted-foreground hover:border-gray-300"
                    }`}
                  >
                    <LayoutList className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">Standard CRM</div>
                      <div className="text-xs opacity-75">Fixed tabs &amp; structure</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustom(true)}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm transition-colors ${
                      isCustom
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 text-muted-foreground hover:border-gray-300"
                    }`}
                  >
                    <Settings2 className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">Custom</div>
                      <div className="text-xs opacity-75">Define your own fields</div>
                    </div>
                  </button>
                </div>
              </div>

              {isCustom ? (
                <CustomFieldBuilder value={customSchema} onChange={setCustomSchema} />
              ) : (
                <>
                  <ChannelSelector
                    channels={channels}
                    onChange={handleChannelsChange}
                    featureToggles={featureToggles}
                    onFeatureTogglesChange={setFeatureToggles}
                  />

                  <TabSelector selectedTabs={enabledTabs} onChange={handleTabsChange} />
                </>
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
