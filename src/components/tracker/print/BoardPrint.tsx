import type { ItemDTO } from "@/lib/tracker/client-types";
import { ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { formatShortDate, plural } from "@/lib/tracker/format";

const COLUMNS: ItemStatus[] = ["not_started", "in_progress", "waiting_on_client", "blocked", "done"];

interface Props {
  /** The cards on screen (owner filter applied), in board order. */
  items: ItemDTO[];
  allItems: ItemDTO[];
  today: string;
}

/**
 * The Board as a table: one column per status, one row per "level" of cards. A table (not a grid of tall columns)
 * is what lets a long column carry on to the next page with the column headings repeated above it.
 */
export function BoardPrint({ items, allItems, today }: Props) {
  const statusById = new Map(allItems.map((i) => [i.id, i.status]));
  const edges = allItems.flatMap((i) => i.blockedByItemIds.map((b) => ({ itemId: i.id, blockedByItemId: b })));
  const columns = COLUMNS.map((status) => ({ status, cards: items.filter((i) => i.status === status) }));
  const depth = Math.max(0, ...columns.map((c) => c.cards.length));
  const dropped = items.filter((i) => i.status === "dropped").length;

  if (items.length === 0) return <p className="print-empty">No items on the board.</p>;

  return (
    <>
      <table className="print-table print-board">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.status} style={{ width: "20%" }}>
                {ITEM_STATUS_LABELS[c.status]} <span className="print-count-inline">{c.cards.length}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: depth }, (_, row) => (
            <tr key={row}>
              {columns.map((c) => {
                const item = c.cards[row];
                if (!item) return <td key={c.status} className="print-board-empty" />;
                const open = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
                const late = open && overdueDays(item.dueDate, today) > 0;
                const unmet = item.status === "done" ? 0 : unmetDependencies(item.id, edges, statusById).length;
                return (
                  <td key={c.status}>
                    <div className="print-card">
                      <span className="print-strong">
                        {item.isMilestone && <span className="print-tag">Milestone</span>}
                        {item.visibility === "internal" && <span className="print-tag">Team only</span>}
                        {item.title}
                      </span>
                      <span className="print-note">
                        {item.ownerName ?? "Unassigned"}
                        {item.dueDate ? `. Due ${formatShortDate(item.dueDate, today)}` : ""}
                      </span>
                      {late && <span className="print-note print-late">{describeDue(item.dueDate, today)}</span>}
                      {item.status === "blocked" && item.blockerReason && <span className="print-note">Blocked: {item.blockerReason}</span>}
                      {item.status === "waiting_on_client" && item.waitingOn && <span className="print-note">Waiting on {item.waitingOn}</span>}
                      {unmet > 0 && <span className="print-note">Waiting for {plural(unmet, "other item")}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {dropped > 0 && <p className="print-count">{plural(dropped, "dropped item")} not shown on the board.</p>}
    </>
  );
}
