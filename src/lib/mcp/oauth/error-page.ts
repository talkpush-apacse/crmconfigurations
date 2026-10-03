import { NextResponse } from "next/server";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Shown when an app's request cannot be trusted enough to send the person back to it (unknown app, or an
 * address the app did not register). We never redirect in that case, so the message stays on our own page.
 */
export function connectErrorPage(message: string, status = 400) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cannot connect</title><style>body{font-family:system-ui,sans-serif;background:#f6f6f4;color:#1d1d1b;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}main{max-width:28rem;background:#fff;border:1px solid #ddd;border-radius:12px;padding:24px}h1{font-size:1.25rem;margin:0 0 8px}p{margin:0 0 8px;line-height:1.5;color:#444}</style></head><body><main><h1>This connection cannot be made</h1><p>${escapeHtml(message)}</p><p>Go back to the app you were connecting and try again. If it keeps happening, tell the person who runs the Talkpush Implementation Hub.</p></main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
