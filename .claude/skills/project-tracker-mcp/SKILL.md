---
name: project-tracker-mcp
description: How to read and update Talkpush implementation projects through the Project Tracker MCP (the "tracker" connector). Use this whenever Jolo asks "where are we on <client project>", "what's still open for <client>", "mark <item> as done/blocked", "add these items to <project>", "who owns <item>", "record this metric", wants a status update drafted from the tracker, wants to link Jira tickets to items, or wants a Gantt chart drawn from, or turned into, a project timeline. Do not use it for the CRM Config Checklist (that is the separate checklist MCP) or for editing the website code.
---

# Project Tracker MCP

The tracker holds one **project** per client implementation (an **account** can have many). Each project has phases
(Scoping, Configuration, UAT, Training, Go-live, Hypercare), **items** (the open work), **people**
(Talkpush staff, client contacts, vendors) and **success metrics**.

Endpoint: `/api/mcp/tracker`. People connect by signing in through Claude (changes are logged as "Claude for <email>"); the shared key `TRACKER_MCP_API_KEY` still works. Full tool list: `references/tools.md`.

## How to work

1. **Find the project first.** `list_tracker_projects` (optionally `account`) gives ids, health and progress.
2. **Answer "where are we?" with `get_project_summary`.** It returns the headline, health and reasons, what is
   overdue / blocked / waiting on the client / due soon, open items grouped by owner side (Talkpush, Client,
   Vendor), phases, metrics and recent activity. Lead with the headline, then the open items that need someone.
3. **Refer to things by name.** Tools accept a project title (`project`), an item title (`item`), a person's name
   (`owner`) and a phase name. If a name is ambiguous the tool lists the candidates: ask Jolo, never guess.
4. **Changing status:** `update_item_status`. Moving to `blocked` needs `blocker_reason`. You can attach a `remark`
   in the same call.
5. **Adding work:** `add_open_items` takes a list. Names are checked before anything is created, so one typo
   creates nothing. Use `blocked_by` (item titles) to set dependencies, including items from the same call.
6. **Jira tickets:** `add_open_items` and `update_item` take `jira_links`: full ticket addresses on
   talkpush.atlassian.net, for example `https://talkpush.atlassian.net/browse/TP-11000`. Other sites are refused.
   `update_item` REPLACES the list, so read the current links first (`list_open_items` shows `jiraLinks`) and send them all.
   Staff only: clients never see them.
7. **Timeline and Gantt charts:** read `references/gantt.md` before drawing a Gantt or building a timeline from one.
   `get_project_timeline` reads the plan, `add_phases` adds phases. Table first, wait for a yes.
8. **Files:** `list_project_files` shows the names of contracts and other files kept in a project's Settings. You can
   see that a file exists; you cannot open it.
9. **Metrics:** `add_success_metric` (name, unit, baseline, target) then `record_metric_reading` for each measurement.

## Rules that matter

- **Client visibility.** Items and metrics you create are **visible to the client by default**, and clients can open
  a private link to the project. Before adding anything sensitive (internal risk, pricing, staffing, blame), set
  `visibility: "internal"`. Remarks default to internal; use `visibility: "shared"` only for text a client may read.
- **Blocker reasons are never shown to clients**, but the item's "Blocked" status is.
- **There is no delete.** `archive_item` hides an item; the activity history keeps it. Do not look for a way to
  remove data.
- **Dates are calendar days** (`YYYY-MM-DD`). Moving a project's `target_date` counts as a reschedule and is shown
  to the team (and to clients as "moved N times"). Confirm with Jolo before moving a committed date.
- **Every change you make is logged** as "Claude (MCP)" in the project's Activity tab. Say what you changed.
- Health is calculated (off track = a milestone more than 5 days overdue; at risk = 2+ blocked items, or an item
  due within 7 days not started, or any overdue item). `update_project` can override it, but needs a note.

## Writing a status update

Use `get_project_summary`, then follow the ACT shape (Acknowledge, Context, Timeline):

- Open with the headline from the summary.
- Name what is done, in progress, waiting on the client, and blocked, separately, with owners.
- Close with a concrete next step and a date (the next milestone or the earliest due item).
- Keep client-facing text to client-visible items only; never quote a blocker reason or an internal remark.

## Quick checks before you write

- Did the tool return an error? Read it: it is written in plain language and usually says exactly what to fix.
- Did you change anything? Re-read the item or summary and report the new state, not what you intended.
