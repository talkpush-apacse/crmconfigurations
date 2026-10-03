# Workflow Builder: task tracker

Spec: `WORKFLOW_BUILDER_MODULE_SPEC.md` (this folder). Branch: `feat/workflow-builder` (not committed yet).
Database: all three SQL files were applied to the live Supabase database on 2026-10-04 at Jolo's request (11 `Workflow*` tables, RLS on, `WorkflowProject` empty, no existing table touched). Rollback `DROP`s are in each file's header comment.
Rule: nothing is deployed, no library is added without Jolo's approval.

## Phase 0: discovery (done)
- [x] Read the spec, mapped the host app (same stack: Next 16.1.6, React 19.2.3, Prisma 7, Tailwind 4).
- [x] Scoping summary approved by Jolo; Phase 1 approved including `@xyflow/react` and `@dagrejs/dagre`.

## Phase 1: faithful port behind the module switcher (done, see "Known gaps")
- [x] Port libs to `src/lib/workflow/`, components to `src/components/workflow/`, REST API to `src/app/api/workflows/`.
- [x] Staff pages `/admin/workflows`, `/admin/workflows/[id]`; client page `/w/[token]`; module switcher + sidebar + home picker.
- [x] Tables drafted: `supabase/migrations/20261004120000_add_workflow_builder.sql` (5 new tables, RLS on, re-runnable). Applied to the LOCAL scratch database only.
- [x] Templates: `scripts/seed-workflow-templates.ts` (refuses non-localhost without `--allow-remote`).
- [x] One edge normalizer (`src/lib/workflow/normalize.ts`) replaces six copies; one `sanitizeText`; client viewer now honours path types and bends (spec F10).
- [x] Replaced libraries the app does not have, with small local helpers: toasts, dates, ids, command palette. No new libraries beyond the two approved.
- [x] AI Generate calls the Anthropic HTTP API directly (no SDK). Default model `claude-sonnet-5-5`, overridable with `WORKFLOW_AI_MODEL`.
- [x] MCP: the 29 original tools served at `/api/mcp/workflows` through the app's toolkit, OAuth sign-in or `WORKFLOW_MCP_API_KEY` (header only).
- [x] Tests: golden parity against the ORIGINAL editor's own code on all 10 templates (numbering, validation, Mermaid, layout), MCP tools, REST API (local DB). `npm test` = 208 pass with a local DB (202 + 6 skipped without).
- [x] Typecheck clean, lint 0 errors, `npm run build` passes (built against the local DB).

### Known gaps in Phase 1 (honest list)
- [ ] **PDF export is a stub** (shows "PDF export is not available yet"). Needs `jspdf`, or wait for the Phase 3 exporter. Jolo to decide.
- [ ] **Editor UI not clicked through by Claude**: needs a logged-in browser session. Only the public client page was checked visually (renders, no console errors).
- [ ] AI Generate untested (needs `ANTHROPIC_API_KEY`).
- [ ] Appendix D "OAuth flow" parity: the app's own Claude sign-in is reused; the workflow endpoint is listed in the OAuth resource list but not yet tried with a real Claude connection.
- [ ] Styling is still the original teal/gray look, not Talkpush Sign (Phase 5).

## Phase 2: access, sharing, concurrency (in progress: "2a, the secure core" is done)
Second SQL file, APPLIED to Supabase 2026-10-04: `supabase/migrations/20261004130000_add_workflow_access.sql`
(6 new tables + a few nullable/defaulted columns on the 3 phase-1 tables; re-runnable; RLS on; rollback in its header).
Applied to the local scratch database and, on 2026-10-04, to Supabase.

### 2a done (server rules, all tested)
- [x] Permission table as code: `src/lib/workflow/access/permissions.ts` (spec 12.2, table-driven test, 23 capabilities x 5 roles).
- [x] Secret links: `access/tokens.ts` (256-bit, hash-only storage, `wfl_`/`wfm_` prefixes, salted passcodes); `linkProblem` / `memberProblem` (revoked, disabled, expired, restricted, passcode).
- [x] Client-safe output: `access/client-view.ts`. Staff-only steps + their connectors removed, `internalNotes`/`visibility` stripped, feasibility hidden unless "show feasibility" is on, payload built from an allow-list, reviewer names/comments never sent. Sanitization lint (ticket numbers, internal ids, tenant addresses) reports only.
- [x] Public share route (`/api/workflows/share/[token]`) now returns that client-safe payload (spec F2, F3). Client page hides feasibility UI when the server omits it; legend no longer says "review before sharing with client".
- [x] Changes as ops (`src/lib/workflow/ops.ts`) + revision-checked save (`access/ops-service.ts`): server applies an editor's ops to the FULL canvas and refuses protected fields / hidden steps. Randomised test (300 sessions) proves hidden steps are never dropped.
- [x] Staff save route: optional `baseRevision` -> 409 on conflict; revision goes up on every canvas save; editing an approved workflow flips it to "changed since approval" (F5, F7).
- [x] Editor: sends `baseRevision`, shows a conflict dialog (Reload latest / Keep my version); step panel has "Staff only" internal notes + "Who can see this step".
- [x] Tests: `workflow-access.test.ts` (44, no DB), `workflow-access-db.test.ts` (3, local DB).

### 2b done (sharing, review, client page), verified
- [x] Server: link/invite resolver (`access/resolve.ts`), guest names (signed cookie), management (`links-service`), publish (`versions-service`), comments, suggestions (accept/reject/withdraw/stale), approvals bound to versions (`feedback-service`), audit log, access requests, presence, revision poll, "preview as" data. Routes: `/api/w/[token]/**` (visitors), `/api/workflows/[id]/{access,links,members,publish,review,comments,suggestions,access-requests,preview}` (staff).
- [x] Old single share links keep working (as a View link that may approve), through the same client-safe page.
- [x] Every canvas writer (editor save, MCP tools, restore, canvas-inject, suggestions) bumps `revision`.
- [x] Client page `/w/<link>` (server-rendered): outline + search, diagram, step details, comments, suggestions (dashed overlays), walk-through, approve / request changes, name prompt, passcode + friendly problem pages + request access, editing and suggesting modes with save state, conflict and refresh banners, presence chips, phone layout (outline-first, sticky sign-off).
- [x] Staff: new Share dialog (people, general access, three links with passcode/expiry/mode, publish vs live, show feasibility, preview as), Review panel (comments, suggestions + accept all, decisions, access requests, activity), dashboard "Needs attention" + badges + group by client, "Preview as" page `/admin/workflows/[id]/preview/[mode]`.
- [x] Tests: `workflow-sharing-db.test.ts` (5 flows incl. legacy), `workflow-client-logic.test.ts`; viewed in the browser pane (desktop + phone): outline, edit, name prompt, saved edit + audit line.
- Honest limits: presence is in memory (per server instance); a secret link is shown once, "Get a new link" replaces it; legacy `WorkflowSharedView`/`SignOffButtons` components are now unused (delete in the Phase 5 cleanup).

### Still to do from the spec's phase 2
- [ ] Editor (staff) uses ops instead of whole-canvas saves, and the in-app inbox page across all workflows (the dashboard badges cover the first need).
- [ ] Not yet clicked by Claude (needs a staff login): Share dialog, Review panel, dashboard badges, preview page.

## Phase 3: Process Map style (DONE in code; staff screens not clicked through)
Third SQL file, APPLIED to Supabase 2026-10-04: `supabase/migrations/20261004140000_add_workflow_diagram_style.sql` (2 defaulted columns).
- [x] Look and rules as code (`process-map/{tokens,model,text-fit}.ts`), decimal numbering, spine layout, connector router, scene builder, flow table + CSV, layout check (12 rules), one shared SVG drawing (`shapes.tsx`).
- [x] Editor wiring: Classic | Process Map switch, Process Map canvas, properties panel, palette items, "Re-run layout" with an "N steps will move" preview, Layout check button, Download menu (SVG, PNG, PDF via Save-as-PDF, CSV).
- [x] Client page draws Process Map diagrams and offers client-safe downloads.
- [x] Scratch helpers in `tests/zz-*` deleted.
- [ ] Not yet clicked by Claude (needs a staff login): editor switch, Re-run layout dialog, Layout check dialog, Download menu.

## Phase 4: MCP v2, flow-table gate, gap check, render preview, replacement skill (DONE)
- [x] 29 original tools kept; 24 new tools (`tool-handlers-v2.ts`, `definitions-v2.ts`); `page` and `baseRevision` accepted everywhere; snapshot before bulk changes; audit events `mcp.<tool>`.
- [x] Flow-table import gate, gap check (`gap-check.ts`), version diff, outline, `render_preview` returns a staff-only preview URL (no PNG: needs an approved rendering library).
- [x] Replacement skill: `docs/workflow-builder/skill/talkpush-agent-workflow-builder/`.
- [x] `WORKFLOW_MCP_API_KEY` header-only (spec finding F19).

## Phase 5: UX polish and performance (DONE except items listed under "Deferred")
- [x] Save state: persistent "Not saved + Retry", keepalive save on tab close, unload flush.
- [x] Command palette (Cmd/Ctrl+K) has a "Go to step" group; Outline tab in the editor's left sidebar (numbered, searchable, click to centre a step).
- [x] One-key shortcuts: `?` shows the list, `F` fits the diagram, `L` opens the layout check.
- [x] Unused old components deleted (`WorkflowSharedView`, `SignOffButtons`); Classic client page gets a collapsible Legend.
- [x] Performance (local timing, 181-step diagram): layout 8 ms, scene 4 ms, layout check 13 ms. Client page ships its own drawing code; the Classic client view still uses the canvas library chunk (about 480 KB raw for the whole `/w/[token]` route).

### Deferred (not done on purpose)
- Toolbar regrouping (risky without seeing it on screen).
- Staff editor still saves the whole canvas (the safe step-by-step edit path is used by client links and MCP only).
- OAuth scopes `workflow:read/write/share`, PNG `render_preview`, presence shared across servers, edits via MCP flipping "approved" to "changed since approval", Talkpush Sign restyle.

### Findings F1-F21 (from the spec)
Resolved: F2, F3, F4, F5, F7, F8, F9, F10, F11, F12, F13, F15, F16, F17, F19. Partly: F1 (save state and retry done, step-level saves for staff not), F14 (Cmd+K, Outline, shortcuts done; toolbar regroup not). Not touched / outside this module: see the spec for F6, F18, F20, F21.

### Last full verification (2026-10-04, local DB)
`tsc` clean, `eslint` 0 new errors (1 pre-existing in `requirements-templates/page.tsx`), 302 tests pass, `next build` passes.

## Observations outside this module (not changed)
- Opening `/admin`, `/admin/tracker` and `/admin/workflows` without a login returns the page shell (HTTP 200) in dev; data routes do return 401. The root `middleware.ts` may not be applied because the app uses `src/`. Worth a separate look.
- `docs/adding-an-mcp-tool.md` says the app has no delete tools; the two workflow tools `delete_node` and `delete_scoping_artifact` exist because the spec keeps all 29 original tool names (diagram edits are recoverable from versions).
