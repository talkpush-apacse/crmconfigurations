# Which tool for what

| I want to | Tool |
|---|---|
| Show the process as words | `get_flow_table` (or draft it in chat before anything exists) |
| Build from an approved table | `create_workflow_from_flow_table` (`approved: true` only after a yes) |
| Build from a full spec | `create_workflow_from_spec` (Process Map style by default) |
| Read a workflow | `get_workflow` (note `revision`), `list_pages` |
| Add or change a step | `add_node`, `update_node`, `delete_node` (optional `page`, `baseRevision`) |
| Add or change a connector | `add_edge`, `add_recovery_edge`, `update_edge`, `delete_edge` |
| Add a note, an end state, a jump marker | `add_node` with type `note`, `terminator`, `jump` |
| Arrange the diagram | `auto_layout` (a snapshot is taken first) |
| Find tangles | `lint_layout` |
| See what a person sees | `render_preview` (`audience: client` for client work) |
| Ask the usual recruitment questions | `run_gap_check` |
| Check structure and text for clients | `validate_workflow` |
| Compare with an earlier version | `diff_versions` |
| Suggest instead of overwriting | `propose_changes`, then the owner accepts |
| Switch look | `set_diagram_style` |
| Share (only when asked) | `create_link`, `invite_person`, `publish_version`, `disable_link`, `revoke_person`, `list_access` |
| Review | `list_comments`, `list_suggestions`, `accept_suggestion`, `reject_suggestion` |
| Pages | `add_page`, `rename_page`, `delete_page` |

## Things the tools do that are easy to miss

- **Revision:** `get_workflow` and every reply that changes a workflow include `revision`. Pass it as `baseRevision` on the next change; the new revision comes back each time. A refusal ("changed since you read it") means someone else edited: re-read, then repeat.
- **Labels on every path:** in `create_workflow_from_flow_table`, put the label in the first row of each path's `branch`, including main-path outputs ("Yes", "Pass"). Branch rows (3.1, 7.1.1) repeat their number on each row of the path.
- **Entry channels:** `entryLabels: ["Facebook ad", "Careers page"]` draws one entry shape per way in. `entryLabel` still gives a single one.
- **Notes:** `add_node` with `type: note` and `attachTo` places the note beside its step straight away; `auto_layout` is only needed after bigger changes. A connector from a decision to a note leaves from the top or bottom, never the side the real paths use.
- **`auto_layout`** takes a snapshot first (so it can be undone) and answers with how many steps moved, not every node. **`create_version_snapshot`** answers with the version number and counts; read the content back with `diff_versions`.
- **Gap check:** a turnaround time in an *info* note attached to the step counts; an orange note does not.
- **Channel and cadence:** in `create_workflow_from_flow_table` give every automated message, call or alert a `channel` and a `timing` (rows); on `add_node` / `update_node` use `data: {channel}` and `timing`. The box shows `Channel · When`; `get_flow_table` adds a Channel · When column when any step has one. The gap check lists automated steps missing either.
