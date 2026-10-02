# Project Tracker MCP tools

All tools accept a project by `project_id` or by `project` (title; add `account` only to tell two same-titled
projects apart). Item tools accept `item_id` or `item` (title, exact or unique partial match).

## Read

| Tool | What it does |
|---|---|
| `list_tracker_projects` | Projects with health, progress, overdue and blocked counts, target date. Filters: `account`, `status`, `include_archived`. |
| `get_project_summary` | "Where are we now": headline, health and reasons, progress, needs-attention lists, open items by owner side, phases, metrics, recent activity. |
| `list_open_items` | Items in a project. Defaults to open (not done or dropped). Filters: `owner`, `status`, `overdue_only`, `include_closed`. |
| `list_accounts` | Client accounts with project and contact counts. |
| `list_people` | Talkpush staff, plus one account's client contacts and vendors. Use it to find owner names. |

## Write

| Tool | What it does |
|---|---|
| `create_account` | A client company. |
| `create_person` | Staff (no account), or a client contact / vendor (give `account`). |
| `create_project` | For an account. Starts with the 7 standard phases. |
| `update_project` | Title, objective, status, dates, owner, sponsor, health override (needs `health_override_note`; `calculated` clears it). Moving `target_date` counts as a reschedule. |
| `update_phase` | A phase's start date, end date, exit criteria. |
| `add_open_items` | One or more items. All names validated first. Supports `blocked_by` (titles or ids, including items earlier in the same call). |
| `update_item_status` | Change status. `blocked` needs `blocker_reason`. Optional `remark`. |
| `update_item` | Title, description, type, priority, visibility, milestone flag, phase, owner, dates, waiting-on. `null` clears owner, phase or a date. |
| `add_item_remark` | A remark. Internal by default; `shared` is visible to the client. |
| `set_item_dependency` | `blocked_by` list with mode `add` (default), `remove` or `replace`. Loops are refused. |
| `archive_item` | Hides an item. Nothing is deleted. |
| `add_success_metric` | Name, unit, direction, baseline, target, optional current value. |
| `record_metric_reading` | A new measurement; the metric's current value follows the newest reading. |

## Values

- Item status: `not_started`, `in_progress`, `waiting_on_client`, `blocked`, `done`, `dropped`
- Item type: `config`, `integration`, `uat`, `training`, `decision`, `risk`, `issue`
- Priority: `high`, `medium`, `low`
- Item visibility: `client_visible` (default), `internal`
- Remark visibility: `internal` (default), `shared`
- Person side: `talkpush`, `client`, `vendor`
- Project status: `planned`, `active`, `on_hold`, `completed`
