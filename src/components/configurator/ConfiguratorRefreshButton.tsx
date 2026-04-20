"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfiguratorRefreshButtonProps {
  onRefresh: () => Promise<void>;
}

export function ConfiguratorRefreshButton({ onRefresh }: ConfiguratorRefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleClick = async () => {
    const confirmed = window.confirm(
      "Refresh will add new items and archive items no longer in scope. Existing statuses and notes are preserved. Continue?"
    );
    if (!confirmed) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={refreshing}>
      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      Refresh from settings
    </Button>
  );
}
