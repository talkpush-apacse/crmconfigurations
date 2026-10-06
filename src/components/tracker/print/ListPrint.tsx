import type { ItemDTO } from "@/lib/tracker/client-types";
import { ITEM_STATUS_LABELS, OPEN_ITEM_STATUSES, type ItemStatus } from "@/lib/tracker/constants";
import { describeDue, overdueDays } from "@/lib/tracker/dates";
import { unmetDependencies } from "@/lib/tracker/dependencies";
import { formatShortDate, plural } from "@/lib/tracker/format";
import { jiraLinksOf } from "../JiraLinks";

interface Props {
  /** The items on screen, already filtered and in order. */
  items: ItemDTO[];
  /** Every item in the project, so "waiting for" counts include items filtered out of the list. */
  allItems: ItemDTO[];
  today: string;
}

/** The List tab as a table. The header row repeats on every page and a row is never split across two. */
export function ListPrint({ items, allItems, today }: Props) {
  const statusById = new Map(allItems.map((i) => [i.id, i.status]));
  const edges = allItems.flatMap((i) => i.blockedByItemIds.map((b) => ({ itemId: i.id, blockedByItemId: b })));

  return (
    <>
      <p className="print-count">{plural(items.length, "item")}</p>
      {items.length === 0 ? (
        <p className="print-empty">No items match these filters.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "42%" }}>Item</th>
              <th style={{ width: "15%" }}>Status</th>
              <th style={{ width: "18%" }}>Owner</th>
              <th style={{ width: "14%" }}>Phase</th>
              <th style={{ width: "11%" }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const open = (OPEN_ITEM_STATUSES as readonly string[]).includes(item.status);
              const late = open && overdueDays(item.dueDate, today) > 0;
              const unmet = item.status === "done" || item.status === "dropped" ? 0 : unmetDependencies(item.id, edges, statusById).length;
              const jira = jiraLinksOf(item.links);
              return (
                <tr key={item.id}>
                  <td>
                    <span className="print-strong">
                      {item.isMilestone && <span className="print-tag">Milestone</span>}
                      {item.visibility === "internal" && <span className="print-tag">Team only</span>}
                      {item.title}
                    </span>
                    {item.status === "blocked" && item.blockerReason && <span className="print-note">Blocked: {item.blockerReason}</span>}
                    {item.status === "waiting_on_client" && item.waitingOn && <span className="print-note">Waiting on {item.waitingOn}</span>}
                    {unmet > 0 && <span className="print-note">Waiting for {plural(unmet, "other item")}</span>}
                    {jira.length > 0 && <span className="print-note">Jira: {jira.map((l) => l.label).join(", ")}</span>}
                  </td>
                  <td>
                    <span className={`print-status print-status-${item.status}`}>{ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}</span>
                  </td>
                  <td>
                    {item.ownerName ?? "Unassigned"}
                    {item.ownerSide && <span className="print-note print-cap">{item.ownerSide}</span>}
                  </td>
                  <td>{item.phaseName ?? "No phase"}</td>
                  <td>
                    {item.dueDate ? formatShortDate(item.dueDate, today) : "No due date"}
                    {late && <span className="print-note print-late">{describeDue(item.dueDate, today)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
