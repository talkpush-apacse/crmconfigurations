/**
 * Pure helpers for the PDF and Excel exports: file names, how the timeline is cut into pages, and how wide a day
 * is when the whole chart must fit one page width. Nothing here touches the DOM, so it is all testable.
 */

/** "Acme Corp: CRM go-live" -> "Acme-Corp-CRM-go-live". Safe in a file name and in a Content-Disposition header. */
export function fileSlug(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 60) || "export";
}

/** "Acme-CRM-go-live-List-2026-10-06" (add the extension yourself). Also used as the PDF's suggested file name. */
export function exportName(parts: { account: string; project: string; view: string; date: string }): string {
  return [fileSlug(parts.account), fileSlug(parts.project), fileSlug(parts.view), parts.date].join("-");
}

/**
 * Pixels per day so a chart `days` long fits `chartWidth` exactly. The chart is drawn as vector graphics, so a small
 * day width stays sharp. It is never allowed to reach zero.
 */
export function fitPxPerDay(days: number, chartWidth: number): number {
  return Math.max(chartWidth / Math.max(days, 1), 0.25);
}

/** Show a week label only as often as the day width allows (a label needs about `labelWidth` px). */
export function weekLabelStep(pxPerDay: number, labelWidth = 36): number {
  return Math.max(1, Math.ceil(labelWidth / (7 * pxPerDay)));
}

export interface PageRow {
  kind: "phase" | "item";
}

/**
 * Cut timeline rows into pages by height. The first page has less room (the report title sits on it). A phase row
 * is never left alone at the bottom of a page: it moves to the next page with its items. A single row taller than
 * the budget still gets its own page rather than looping forever.
 */
export function paginateRows<T extends PageRow>(rows: readonly T[], heights: { phase: number; item: number }, firstBudget: number, budget: number): T[][] {
  const pages: T[][] = [];
  let current: T[] = [];
  let used = 0;
  let limit = firstBudget;

  const flush = () => {
    if (current.length > 0) pages.push(current);
    current = [];
    used = 0;
    limit = budget;
  };

  for (const row of rows) {
    const h = heights[row.kind];
    if (current.length > 0 && used + h > limit) {
      // Do not strand a phase heading at the foot of a page.
      const stranded = current[current.length - 1].kind === "phase" ? current.pop() : undefined;
      flush();
      if (stranded) {
        current.push(stranded);
        used += heights.phase;
      }
    }
    current.push(row);
    used += h;
  }
  flush();
  return pages;
}

/** Cut a label to fit `maxChars`, ending in an ellipsis. SVG text cannot truncate itself. */
export function truncateText(text: string, maxChars: number): string {
  if (maxChars < 2) return "";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
