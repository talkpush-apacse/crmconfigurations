"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * "Download Excel" for the client pages (view-only and contributor links). The link's secret is in the address,
 * so the request carries no cookies and no referrer, like every other call these pages make.
 */
export function ClientDownloadButton({ url }: { url: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(res.status === 404 ? "This link is not available." : (payload?.error ?? "The Excel file could not be made. Please try again."));
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "Project-Tracker.xlsx";
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Excel file could not be made. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--es-line)] bg-[var(--es-card)] px-4 text-sm font-medium text-[var(--es-ink)] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {busy ? "Preparing your file" : "Download Excel"}
      </button>
      <p className="text-xs text-[var(--es-muted)]">Summary, List, Board and Timeline in one file, as of now.</p>
      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--es-ink)]">
          {error}
        </p>
      )}
    </div>
  );
}
