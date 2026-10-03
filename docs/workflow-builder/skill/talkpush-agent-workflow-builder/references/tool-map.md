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
