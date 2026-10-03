# Workflow Builder Module — Migration & Upgrade Spec

**Audience:** an Opus 5.5 coding agent working in a *different* Claude Code project (the "host project").
**Owner:** Jolo Yu (Solutions Engineer, non-developer — see §0.4 for how to talk to Jolo).
**Source system:** `Workflow Intake Form and Live Editor` (the "source repo"), commit `1bb8c86` (2026-04-24), app version 1.18.0.
**Spec date:** 2026-10-03 · **Revision 3** (same day, after Jolo answered the open questions and supplied two reference diagrams: *MyPal Proposed Flow Oct 2 2026* and *Teleperformance PH pilot journey v5*).

> **Revision 3 (final, "okay go"):** `[ALERT]` is a real tag (D9); the Diagram key has no tag icons (D10); Edit-link default = suggest-only + 30-day expiry (D11). Spec is ready to hand to the build agent.
>
> **Revision 2 changes:** (1) access model is now **Google-Drive-style** — separate *View / Comment / Edit* links plus named invites, all **copy-link** (no email) — see §12; (2) Client Editors can **edit directly *or* suggest-then-accept** (§12.6b); (3) added §15.8 with **measured colors, shapes and conventions taken from Jolo's two real diagrams**, which resolves the open question about terminator hex values; (4) decisions D1–D4, D6 and D8 are closed; D5 stays a recommendation; D7 stays deferred.

> Evidence tags used throughout: **[V]** = verified by reading the source code (file path given) · **[S]** = taken from Jolo's Lucid skill (`talkpush-agent-lucid-workflow`) · **[J]** = judgment/recommendation, not a fact about the code · **[?]** = could not verify, check before relying on it.
> Nothing in the source repo was modified to produce this document. Several claims about *rendered* behaviour are code-read only; where that matters it is flagged **[V-code]** (verified in code, not reproduced visually).

---

## 0. Read this first

### 0.1 What this document is
- **Part A (§1–§11)** describes how the Workflow Editor works *today*, precisely enough to port it.
- **Part B (§12–§20)** describes what to build *on top of it*: three user roles, client-grade sharing, Lucid-quality diagrams, a stronger MCP/AI path, and UX/performance upgrades.
- **Part C (§21–§25)** is the execution plan: phases, autonomy limits, validation, reporting.
- **Appendices** hold reusable data tables (tag/icon taxonomy, colors, finding codes, JSON examples).

### 0.2 Objective (one paragraph)
Port the Workflow Editor (React Flow canvas, versioning, sharing, AI/MCP authoring) into the host project as a **Workflow Builder module**, then upgrade it so Jolo can (a) author *Lucid-quality* hiring/integration process maps without leaving the tool, (b) share them with clients **without making clients create an account or download PDFs**, and (c) control who can **view** vs **edit**. Access works like **Google Drive**: Jolo is the **Super Admin/owner**; everyone else gets a **Viewer**, **Commenter** or **Editor** level (an Editor can edit directly or work in suggest-then-accept mode) through copyable links or named invites.

### 0.3 Why this exists (the real problem)
Jolo currently builds diagrams in Lucidchart through the Lucid MCP, guided by a Claude skill that encodes a strict visual system. Quality is good, but Lucid will not let a client open a link without a Lucid account, so every diagram is exported to PDF and emailed. The source repo already has a share link + sign-off flow, but its diagrams are visually generic, its exports are weak, its sharing model is "anyone with the link can approve," and it has no roles. The module must close those gaps so Lucid is no longer needed.

### 0.4 How to talk to Jolo (applies to every question, plan, and report)
Jolo is not a software engineer. Lead with the real-world choice, describe options by what Jolo will *see or be able to do*, recommend one option, name the trade-off and whether it is easy to undo, ask **one decision at a time**, and define any unavoidable technical term in a few words. Never ask Jolo to choose between implementation details that have a sensible default. Do not claim visual correctness without screenshots or browser evidence.

### 0.4b Kickoff (for Jolo — paste this into the new project's Claude Code session)
1. Copy into the new project, e.g. `docs/workflow-builder/`: this file and the six `.skill` files (`talkpush-agent-lucid-workflow`, `agent-consultant-ux-plan`, `-ux-design`, `-ux-audit`, `-nextjs-vercel-performance-optimizer`, `agent-assistant-opus-55-prompt-architect`). Also copy the source repo's `src/` workflow files (the agent can read them from the original folder path if it has access; otherwise copy `src/lib/workflow-*.ts`, `src/lib/edge-routing.ts`, `src/components/workflow/`, `src/mcp/`, `src/app/api/workflows/`, `src/app/api/mcp/`, `prisma/schema.prisma` + `prisma/workflow-template-data.ts`).
2. Start Opus 5.5 with:
   > Read `docs/workflow-builder/WORKFLOW_BUILDER_MODULE_SPEC.md` completely. You are building the Workflow Builder module described there into this project. Start with Phase 0 (read-only discovery of this project), then give me the scoping summary in the structure the spec requires and wait for my go-ahead before changing anything. Follow §0.4 when you talk to me, and keep a `TASKS.md`.

### 0.5 Decisions (all confirmed by Jolo on 2026-10-03 unless marked)
| # | Decision | Status |
|---|---|---|
| D1 | Lucid visual system becomes a first-class diagram style ("Process Map"); Classic stays for old workflows | **Confirmed** |
| D2 | Roles = Super Admin + Drive-style levels **Viewer / Commenter / Editor**. Jolo's three profiles map to Super Admin, Client Viewer (Viewer/Commenter), Client Editor (Editor) | **Confirmed** (Commenter added by Jolo's Drive reference) |
| D3 | Clients get in by **personal link** (no password, no account form). Also a shared link per level, Drive-style | **Confirmed** |
| D4 | Client Editors can **edit directly *and* suggest-then-accept** (Docs-style "Editing / Suggesting" toggle; Jolo can force a person/link to suggest-only) | **Confirmed** |
| D5 | Keep Classic alongside Process Map; Process Map default for new workflows | Recommended (not objected to) |
| D6 | **No emails sent by the module.** "Copy link" buttons only. Email can be added later if the host already sends email | **Confirmed** (Jolo: "I prefer copy invite link") |
| D9 | **`[ALERT]` is a real tag** (15 tags total; internal-recipient notifications) | **Confirmed** |
| D10 | **Diagram key has no tag icons** (color/shape rows only) | **Confirmed** |
| D11 | **Edit link defaults:** suggest-only mode, 30-day expiry (Jolo can change per link) | **Confirmed** ("okay go") |
| D7 | Realtime co-editing (live cursors/CRDT) | Deferred (unchanged) |
| D8 | Exact colors/shapes come from Jolo's two reference diagrams (measured, §15.8) | **Confirmed** (diagrams supplied) |

---

# PART A — HOW THE SOURCE SYSTEM WORKS TODAY

## 1. Product summary [V]

The source repo is two tools in one Next.js app:
1. **Workflow Intake Form** — a client-facing multi-step form (not part of this migration).
2. **Live Workflow Editor** — an authenticated React Flow canvas where Solutions Engineers (SEs) build hiring-process diagrams, number steps, version them, validate them, and send a read-only link to the client for approval. This is the migration target.

Who uses the editor today: SEs only (`AdminUser` rows; no self-registration). Clients only ever see the public read-only page and a two-button sign-off.

**There are no roles, no per-workflow ownership, and no tenant scoping.** Any authenticated `AdminUser` can read, edit, share, restore and delete *every* workflow. [V] `src/lib/api-auth.ts` (authentication only), `prisma/schema.prisma` (no owner column on `WorkflowProject`).

### 1.1 Stale documentation warning
`CODEBASE_SUMMARY.md` in the source repo is **out of date**. Do not trust it over this file. Confirmed discrepancies [V]:
| CODEBASE_SUMMARY.md says | Reality |
|---|---|
| Next.js 14 | `next` **16.1.6**, React **19.2.3**, Tailwind 4, Prisma **7** |
| `ActorType` includes `"recruiter"` | Actual: `automated \| manual \| integration \| candidate \| source` |
| `FeasibilityLevel` includes `"unknown"` | Actual: `confirmed \| likely \| needs_review` |
| Workflow PDF via `@react-pdf/renderer` | Workflow PDF uses **jsPDF** (`src/lib/workflow-pdf-export.ts`); `@react-pdf` is only used by the intake-form PDF |
| PNG export via `html-to-image` | **No PNG export exists**; `html-to-image` is a dependency but unused |
| `requireAuth` from `@/lib/auth`, awaited | It lives in `@/lib/api-auth` and is synchronous |
| "Version 1.11.0" | Current is **1.18.0** (`CHANGELOG.json`) |
| `shared/[token]` = "legacy shared workflow view route" | It is the **intake-form** share-link handler (`IntakeFormShell`); the workflow client view is only `/workflow-share/[token]` |

## 2. Tech stack (as built) [V]
`package.json`:
- Framework: Next.js 16.1.6 App Router, React 19.2.3, TypeScript 5, Tailwind CSS 4, shadcn/ui (Radix), `lucide-react` icons, `sonner` toasts, `cmdk` command palette, `date-fns`.
- Canvas: `@xyflow/react` ^12.10.2, layout `@dagrejs/dagre` ^3.0.0.
- Data: Prisma 7 (`prisma-client` generator → `src/generated/prisma`), `@prisma/adapter-pg` + `pg`, PostgreSQL (Neon in prod; Supabase mentioned in older docs).
- AI: `@anthropic-ai/sdk`; workflow generation uses model **`claude-sonnet-4-20250514`**, `max_tokens: 4096` (`src/app/api/workflows/generate/route.ts`). Consider upgrading the model id (see §20).
- Auth: `jsonwebtoken` + `bcryptjs` (cookie `admin_token`, 7-day JWT, httpOnly, sameSite=lax, secure in prod), `jose` in `middleware.ts`.
- Export: `jspdf` (workflow PDF), `@react-pdf/renderer` (intake only), `html-to-image` (unused).
- Misc: `nanoid`, `@vercel/blob` (uploads, not workflow-related).
- Hosting: Vercel. **There are no automated tests** (no `*.test.*`/`*.spec.*`, no test runner in `package.json`).

## 3. Port map — what to bring and what to leave

### 3.1 Bring (workflow-specific)
| Source path | What it is | Port treatment |
|---|---|---|
| `src/lib/workflow-types.ts` | All workflow TypeScript types + config constants | Port, then extend (§13, §17) |
| `src/lib/workflow-numbering.ts` | Pure step-numbering engine (render-time) | Port; add `decimal` scheme (§15) |
| `src/lib/workflow-layout.ts` | Dagre auto-layout + decision-branch normalizer | Port for "Classic"; **new engine** for "Process Map" (§16) |
| `src/lib/edge-routing.ts` | Orthogonal path + draggable-waypoint math | Port as-is |
| `src/lib/workflow-validation.ts` | Deterministic structural findings | Port; extend (§18) |
| `src/lib/workflow-versioning.ts` | Snapshot transaction | Port; add `revision` + actor attribution |
| `src/lib/workflow-mermaid.ts` | Mermaid export | Port |
| `src/lib/workflow-pdf-export.ts` (823 lines) | jsPDF vector export, A4 landscape, active page only | **Replace** (§14.3) |
| `src/lib/workflow-ai-prompt.ts` | Talkpush-platform system prompt for AI generation | Port; keep Talkpush content configurable |
| `src/lib/workflow-scoping.ts` | Scoping-artifact CRUD helpers | Port |
| `src/components/workflow/**` | Editor, nodes, edge, panels, modals, shared view | Port, then split/refactor (§19) |
| `src/app/(se)/se/workflows/page.tsx`, `src/app/(se)/se/workflows/[id]/page.tsx`, `src/app/(public)/workflow-share/[token]/page.tsx`, `src/components/layout/SENavBar.tsx` | Staff dashboard route, editor route, public client route, staff nav | Port the routes; adapt nav/layout to the host shell. `src/middleware.ts` only guards `/se/*` — replace with the host's guard + the new role checks |
| `src/components/ui/*` | shadcn primitives | **Use the host's design system if it has one**; otherwise port |
| `src/mcp/*`, `src/app/api/mcp/**`, `src/app/.well-known/**`, `src/app/api/oauth/**` | MCP server (JSON-RPC over HTTP) + OAuth 2.1 for MCP | Port the tool layer; reuse host auth if it exists (§12.4, §17) |
| `src/app/api/workflows/**` | REST API for workflows | Port with new authorization layer (§13) |
| `prisma/schema.prisma` models: `WorkflowProject`, `WorkflowVersion`, `WorkflowFeedback`, `WorkflowTemplate`, `WorkflowScopingArtifact` | Persistence | Port as additive migrations (§13) |
| `prisma/workflow-template-data.ts`, `prisma/seed-templates.ts` | 10 seed templates (e.g. "High-volume screening", "Interview scheduling and no-show recovery", "Retail frontline hiring", "ATS/HRIS status sync", "Background/reference checks in parallel", "Employee referral flow") | Port |
| `CHANGELOG.json` + `components/about/ChangelogSection.tsx` | In-app changelog | Optional |

### 3.2 Leave behind
Intake form (`components/intake/**`, `app/(public)/intake/**`, `api/intake/**`), intake submissions & SE scoping UI (`app/(se)/se/submissions/**`, `api/se/**`), intake `ShareLink` model & routes, `lib/mapping.ts`, `lib/constants.ts` (intake sections), `lib/checklist-transformer.ts`, `lib/pdf-export.tsx` (intake PDF), `api/upload` (Blob).

### 3.3 Known duplication to fix while porting [V]
Edge normalization (`normalizeWorkflowEdgeData` / `normalizeEdgeData`) exists in **six places** with slightly different behavior: `WorkflowEditor.tsx`, `WorkflowSharedView.tsx`, `app/api/mcp/workflows/_helpers.ts`, `lib/workflow-numbering.ts` (`edgeData`), `lib/workflow-mermaid.ts`, `lib/workflow-pdf-export.ts`. They already disagree (e.g. the shared view and numbering ignore `pathSemantic`/`waypoints`; the shared view paints happy-path `#00BFA5`, the editor `#10B981`). **Create one `normalizeEdge()` / `normalizeNode()` module and use it everywhere.** Same for the `sanitizeText` helper (copy-pasted in ≥5 route files).

## 4. Data model [V] (`prisma/schema.prisma`)

```
WorkflowProject
  id, clientName, workflowName, description?
  status        "draft" | "shared" | "approved" | "changes_requested"   (default draft)
  templateId?   → WorkflowTemplate
  nodes Json, edges Json, viewport Json      ← LEGACY mirror of pages[0] (kept for old code paths)
  pages Json    [{ id, name, nodes, edges, viewport }]                  ← source of truth
  shareToken?   (unique, nanoid(12))
  shareVersionId?  → pins the public view to a WorkflowVersion
  currentVersion Int (monotonic counter), createdAt, updatedAt
  relations: feedback[], versions[], scopingArtifacts[]

WorkflowVersion      snapshot: versionNumber, label?, status, triggeredBy ("status_change"|"manual"|"restore"),
                     triggerDetail?, createdByName?, nodes, edges, viewport?, pages?, nodeCount, edgeCount
WorkflowFeedback     action ("approved"|"changes_requested"), reviewerName (free text), comment?   — NO FK to a version
WorkflowScopingArtifact  kind (assumption|open_question|risk|decision|call_note|customer_summary),
                     title, detail, status (open|confirmed|resolved|dismissed), severity (info..critical),
                     owner?, source (mcp|manual|transcript|validation), metadata Json
WorkflowTemplate     name, description?, industry ("bpo"|"retail"|"general"), nodes, edges
AdminUser            email (unique), passwordHash, name         ← SE accounts
```

Critical behaviors:
- **Pages.** A workflow is 1..N pages (canvas tabs). On save the server mirrors `pages[0]` into the legacy `nodes/edges/viewport` columns. `POST /api/workflows` always seeds a "Page 1". [V] `api/workflows/[id]/route.ts`, `api/workflows/route.ts`.
- **Payload duplication.** The editor autosave sends `nodes`, `edges`, `viewport` **and** `pages` (which contains the active page's nodes/edges again), so every save ships the active canvas twice and the DB stores it twice. [V] `WorkflowEditor.tsx` `handleSave`.
- **Render-time-only fields are never persisted:** `stepNumber`, `hasWarning`, `isOverflow`, `isMerge`, `hideLabel`, `onLabelChange`, `onOpenSuggestion`. They are injected in the `renderNodes` memo and must never be saved. [V]
- **Versions** are created: on first ever canvas save ("Initial version"), on every status transition (including client sign-off), manually, and twice around a restore. They are **not** time-based autosnapshots. The `status` stored on a version is the status *before* the transition (the transition is in `triggerDetail`). [V] `api/workflows/[id]/route.ts`, `workflow-versioning.ts`, `…/restore/route.ts`.
- **Status vs. edits.** Editing the canvas does **not** change `status`. An "approved" workflow can be edited afterwards and stays "approved"; with an unpinned (live) share link the client sees the changed diagram under an "Approved" badge. Feedback has no version FK. [V] `api/workflows/[id]/route.ts`, `schema.prisma`.
- **Concurrency.** `PUT /api/workflows/[id]` is last-write-wins (no revision/ETag). The editor loads the workflow once and never polls or subscribes (no `setInterval`/`EventSource`/`WebSocket` in `components/workflow`). Edits made by MCP/another tab are silently overwritten by the open editor's next autosave. [V]

### 4.1 Node JSON (React Flow node) [V] `workflow-types.ts`
```jsonc
{
  "id": "node_ab12cd34",                  // nanoid(8) with "node_" prefix
  "type": "stage",                        // React Flow node component key (see 5.1)
  "position": { "x": 350, "y": 240 },
  "style": { "width": 120, "height": 120 }, // optional (decision diamonds; resize persists here / width,height)
  "data": {
    "label": "Prescreening",              // keep ≤40 chars (AI hard cap)
    "type": "stage",                      // NOTE: node.data.type, NOT data.nodeType
    "actor": "automated",                 // automated|manual|integration|candidate|source
    "actorLabel": "Talkpush Automation",  // free text shown under label
    "notes": "…",                         // currently shown to clients (see §12.3)
    "feasibility": "confirmed",           // confirmed|likely|needs_review
    "feasibilityNote": "…",               // required by validation when likely/needs_review; currently shown to clients
    "customColor": { "background": "#…", "border": "#…", "name": "…" } | null,
    "data": {                             // Talkpush metadata bag
      "talkpushStage": "…", "talkpushAction": "move_candidate", "waitDuration": "24 hours",
      "targetFolder": "…", "channel": "sms", "messageTemplate": "…", "campaignType": "job_application",
      "integrationSystem": "Workday", "integrationDirection": "push", "ownerRole": "Recruiter",
      "customFields": { "k": "v" }
    }
  }
}
```
Table nodes add `columns[]`, `rows[]`, `headerColor`, `compact` directly on `data`. Annotation nodes use `type:"annotation"` with `data.isAnnotation:true`, `shape` (`rect|rounded-rect|circle|diamond|text-label|divider`), `fillColor`, `borderColor`, `borderStyle`, `fontSize`, `textAlign`, `opacity` (0.1–1), `bold`, `italic`, `zIndex` (default −1). `dangling_endpoint` nodes are tiny dashed anchors created when an edge is dropped on empty canvas.

### 4.2 Edge JSON [V]
```jsonc
{
  "id": "edge_xy98zw76", "source": "node_a", "target": "node_b",
  "sourceHandle": "bottom", "targetHandle": "top",   // handles: top|right|bottom|left (all typed "source"; ConnectionMode.Loose)
  "type": "custom",
  "data": {
    "label": "Pass",
    "lineType": "smoothstep",              // bezier|straight|step|smoothstep (default smoothstep; "bezier" is coerced to smoothstep in the editor)
    "markerStart": "none", "markerEnd": "arrowclosed",   // none|arrow|arrowclosed
    "strokeColor": "#6B7280", "strokeWidth": 1,          // 1|2|3
    "animated": false,
    "pathSemantic": "neutral",             // happy|failure|recovery|neutral → drives color (#10B981 / #F87171 / #F59E0B / #6B7280)
    "isHappyPath": false, "isRecovery": false,           // LEGACY booleans, derived from pathSemantic, kept for export compat
    "isPrimary": true,                     // marks the main-flow outgoing edge from its source (drives numbering)
    "recoveryLabel": "↩ Returns to Step 3",
    "waypoints": [{ "x": 410, "y": 300 }]  // optional user-dragged bends for step/smoothstep edges
  }
}
```

## 5. Editor behavior (feature inventory)

### 5.1 Node types [V]
Nine **workflow** types + three **visual-only** + one helper:
| Type | Palette color (bg / border) | Default actor | Notes |
|---|---|---|---|
| `source` | `#ECFDF5` / `#10B981` (emerald pill) | source | Entry channel. **Excluded from step numbering.** |
| `stage` | `#F0FDFA` / `#00BFA5` | — | Generic process step |
| `decision` | `#FFFBEB` / `#F59E0B` (rotated-square diamond, min 160px, aspect-locked resize) | automated | Branching point |
| `communication` | `#EFF6FF` / `#3B82F6` | automated | SMS/email/WhatsApp/etc. |
| `integration` | `#F5F3FF` / `#8B5CF6` | integration | ATS/HRIS/vendor sync |
| `parallel` | `#FDF2F8` / `#EC4899` | — | Simultaneous workstreams |
| `wait` | `#F9FAFB` / `#6B7280` | automated | Delay/hold |
| `manual_action` | `#FFF7ED` / `#F97316` | manual | Human step; "Candidate Action" shortcut = `manual_action` with `actor:"candidate"` |
| `table` | `#F8FAFC` / `#475569` | none | Editable columns/rows reference table |
| `swimlane`, `frame` | container | — | Visual grouping; excluded from numbering/validation/export logic |
| `annotation` | canvas-only | — | 6 shapes; excluded from numbering, validation, Mermaid |
| `dangling_endpoint` | helper | — | Excluded from numbering |

Actors (`ACTOR_CONFIG`): `automated` "Talkpush Automation" `#00BFA5`, `manual` "Talkpush User" `#F97316`, `integration` `#8B5CF6`, `candidate` `#3B82F6`, `source` `#10B981`. Node **color encodes node type, not who acts** (contrast with the Lucid system, §15).

Talkpush autoflow action keys (`TALKPUSH_ACTIONS`, 12): `move_candidate, create_application, add_data, voice_ai_call, assign_labels, send_question_set, share_profile, send_messenger, send_email, send_sms, send_whatsapp, trigger_lead_scoring`.

### 5.2 Canvas interactions [V] (`WorkflowEditor.tsx`, 3,735 lines; `EditorInner` alone holds ~50 React hooks: 23 `useState`, 15 `useCallback`, 7 `useEffect`, 4 `useMemo`, 2 `useRef`)
- **Add nodes:** click or drag from the left sidebar (tabs *Nodes / Layout / Settings*), `⌘/Ctrl+K` command palette (add-only), bottom **QuickAddBar**, or hover a node and click the **＋** buttons on its right/bottom → `NodeSuggestionPopup` (type suggestions by source type; for decision/parallel sources an "is happy path" toggle).
- **Connect:** drag between any of 4 handles on each node (Loose mode); drop on empty canvas creates a **dangling endpoint**; connecting **into a node that already has a step number** (i.e. a node already placed in the flow) opens `EdgeTypeModal` so the user declares the new link as *recovery / branch / happy* (`onConnect`: `stepNumbers.has(connection.target)`); connecting to an un-numbered node creates a plain edge (first outgoing edge from a source is auto-`isPrimary`). Reconnect by dragging an edge end (16px radius).
- **Edit:** double-click label inline; right panel `NodeProperties` (label, type, actor, notes, feasibility + note, Talkpush metadata, custom color, table editor, annotation styling); `EdgeProperties` (label, path type, line type, markers, width, animated, primary toggle, reset routing); double-click an edge to edit its label inline; right-click edge → `EdgeContextMenu` (mark happy/recovery, add label, reset waypoints, delete).
- **Draggable connector routing:** click-drag a step/smoothstep edge segment to offset it (creates `waypoints`); commit on pointerup via a `window` CustomEvent `rflow:waypoints-committed`; "Reset routing" clears them.
- **Selection:** Pan/Select segmented control (Select = lasso, partial selection mode); multi-select with Delete; `Ctrl+C / V / D` copy-paste-duplicate (fresh ids, internal edges kept); `Delete/Backspace` manual (React Flow's delete key is disabled); `Ctrl+Z / Ctrl+Shift+Z` undo/redo.
- **Undo/redo:** in-memory snapshots (`MAX_HISTORY = 20`) of full nodes+edges arrays, reset on page switch.
- **Layers:** View menu toggles *Workflow nodes / Annotations / Node labels / Step numbers*; canvas **Lock** (disables drag/connect/select); **Minimap** toggle; zoom/fit controls (custom panel, bottom-left).
- **Containers:** Add swimlane / frame (visual grouping).
- **Pages:** bottom `PageTabs` — click switch, double-click rename, hover trash with 2-click confirm (3s auto-clear), "+" adds `Page N`.
- **Autosave:** every change calls `triggerSave` → 2 s debounce → `PUT /api/workflows/[id]` with `{nodes, edges, viewport, pages}`. A pending debounce is flushed on component unmount. **No `beforeunload`/`sendBeacon`/`keepalive`** [V grep] so closing the tab inside the 2 s window can drop edits. Top bar shows *Saving…* and *Saved*; the `"unsaved"` state exists in code but **renders nothing** (only a transient toast) [V `WorkflowEditor.tsx` ~2672–2686].
- **Save-name:** top-bar workflow name click-to-rename (separate `PUT`).
- **Version dropdown** (top bar): last 5 versions; "View full history" opens `VersionHistory` panel (list, preview in a read-only React Flow, manual "Save current as version" with label, restore with confirm).
- **SE Brief panel:** scoping artifacts CRUD (assumption / open question / risk / decision / call note / customer summary; status; severity; owner), "Run validation" (calls `/validate`), "Generate customer summary" (calls `/summary`).
- **Export menu:** *Export as PDF*, *Export N selected as PDF* (lasso selection, auto-crop, drop dangling edges), *Copy Mermaid diagram*, *Save as Template*.
- **Share dialog:** generate/reuse token link, choose **Live vs pinned version**, revoke (→ status back to `draft`).
- **AI Generate:** modal with a plain-English prompt → `POST /api/workflows/generate` → nodes/edges appended below existing content, auto-laid out, then **re-laid out once after React Flow reports real node sizes** ("Layout optimized" toast).
- **Layout/numbering buttons:** *Auto-arrange* (Dagre, **top-to-bottom only** in the UI) and *Re-number* (bumps a render counter).
- **Mobile:** below `lg` a banner says the canvas is "designed for desktop screens". [V]

### 5.3 Measure-before-layout (v1.18.0) [V]
First layout uses fallback sizes (decision 120×120, table 280×180, other 240×80). `handleNodesChange` caches real sizes reported by React Flow; when `measurementPendingRef` is set (only the AI-generate path sets it), a 100 ms debounced pass re-runs Dagre with measured sizes once **every** node is measured. A `TODO` in the code notes that MCP/template paths do not set this flag, so MCP-created and template-created workflows are laid out with fallback sizes only. [V `WorkflowEditor.tsx` ~2268–2273]

## 6. Algorithms

### 6.1 Step numbering [V] `src/lib/workflow-numbering.ts` (pure; computed at render time; never persisted)
Output: `{ stepNumbers: Map<nodeId,label>, recoveryEdges: Map<edgeId,"↩ Returns to Step N">, warnings: Set, overflowNodes: Set, mergeNodes: Set }`.

Excluded from numbering: annotations, `source`, `dangling_endpoint`; containers via annotation flag only (swimlane/frame are not filtered by type here — [?] confirm they never carry edges).
Entry point = first remaining node with no incoming edge (else first node) → label `"1"`.

| Situation | Result |
|---|---|
| One normal outgoing edge on the main path | next whole number (`3`→`4`) |
| Multiple outgoing edges, one `isPrimary` (fallback `isHappyPath`) | primary → next whole number; others → letters `3a, 3b…` sorted **left→right by target x-position** |
| Multiple outgoing, no primary, node is `decision`/`parallel` | node gets a warning ⚠ (`warnings`); all outgoing become letters |
| Inside a branch (`3a`) | sequential `3a.1`, `3a.2`… |
| Depth > 3 (`3a.1` is the deepest allowed) | target flagged `isOverflow` ("⚠ deep") |
| `isRecovery` edge | target label `3r` (off main) or `3a.r` (off branch); terminal; cycle back to an already-numbered node → edge label `↩ Returns to Step N` |
| Branch whose single outgoing edge hits a node with >1 non-recovery incoming | resume main sequence at `nextMain(parentMain)`; tracked in `mergeNodes` |
| Disconnected node | `U1, U2…` |

Branch letters depend on **node x-positions**, so dragging a node can renumber branches. Because it runs inside a `useMemo` keyed on `[nodes, edges, renumberVersion]`, it recomputes on every drag tick [V]. (See §19.)

### 6.2 Auto-layout [V] `src/lib/workflow-layout.ts`
Dagre (`rankdir` TB or LR). `nodesep = max(80, maxWidth + 60) (+40 if any edge has a label)`; `ranksep = max(120, maxHeight + 80)`; sizes are measured when provided else per-type fallbacks. Then `normalizeDecisionBranches`: for each decision with ≥2 children, sort children by `pathSemantic` rank (**failure 0 → neutral 1 → happy 2 → recovery 3**) then x, and re-place them symmetrically **below** the decision, centered, shifting each child's whole downstream subtree. Known defects [V]:
- **LR layout never rewrites edge handles.** Edges stay `bottom → top`, so horizontally laid-out workflows route oddly. `autoLayout` (MCP) and `getLayoutedElements` only move nodes.
- The UI "Auto-arrange" is TB only; `direction` is exposed only via the MCP `auto_layout` / `layoutDirection`.
- Server-side layout (MCP, templates) cannot measure nodes (no DOM), so it uses fallback sizes.
- Layout has **no notion of a spine**, no clearance rules, no merge/jump handling, and no check for connectors crossing unrelated shapes.

### 6.3 Edge routing [V] `src/lib/edge-routing.ts`
`HANDLE_OFFSET = 40`, `DEGENERATE_THRESHOLD = 8`. Builds source-exit/target-approach points, `autoRouteWaypoints` (approximates React Flow `getSmoothStepPath`), `buildOrthogonalPath` (optional rounded corners, radius 8 for smoothstep), segment hit-testing, `applySegmentDrag` (translates a draggable segment; degenerate segments get a Z-shape). Only segments whose both endpoints are waypoints are draggable.

### 6.4 Validation [V] `src/lib/workflow-validation.ts`
Returns `WorkflowValidationFinding[]` `{ code, severity, message, nodeId?, edgeId?, recommendation? }`. Codes: `dangling_edge`(high), `missing_source`(high), `orphan_node`(medium), `branching_node_too_few_paths`(medium), `missing_happy_or_primary_path`(high), `branch_does_not_terminate_or_rejoin`(medium; terminal is inferred from **label substrings**: hired, rejected, withdrawn, disqualified, not selected, complete(d), closed), `wait_missing_duration`(medium), `communication_missing_metadata`(medium), `integration_missing_metadata`(high), `manual_action_missing_owner`(medium), `feasibility_missing_note`(high if needs_review else medium), `duplicate_node_label`(low), `recovery_target_not_numbered`(high). Annotation nodes are excluded. Terminal detection by label text is brittle — replace with an explicit terminator kind (§15).

### 6.5 Mermaid export [V]
`toMermaid(nodes, edges, stepNumbers?)` → `flowchart TD`; decision `{}`, integration `[[ ]]`, others `[ ]`; connector from markers/animation; step numbers prefixed to labels.

### 6.6 PDF export [V] `workflow-pdf-export.ts` (jsPDF, client-side)
Vector (text selectable, ~30–150 KB). A4 **landscape**, margins 32/14/16/14 mm; **one page**; scales the canvas bounding box to fit (`scale = min(contentW/bw, contentH/bh)`), **no minimum font size**, so large workflows become tiny text. Exports **only the currently active page**. Header = client name, workflow name, "Generated <date>" only (no version, author, legend, or flow table). Own copy of node/edge drawing logic (does not share rendering with the canvas). Selection export crops to the selection. File name `"{Client} - {Workflow}[ (selection)].pdf"`.

## 7. Public sharing & sign-off today [V]
- `POST /api/workflows/[id]/share` (auth) creates `shareToken = nanoid(12)` (reused if present), sets `status="shared"`, snapshots the prior state, returns `/workflow-share/<token>`. `PUT` pins/unpins `shareVersionId`. `DELETE` revokes (token null, status `draft`).
- `GET /api/workflows/share/[token]` (**public**, no auth) returns the **entire** `WorkflowProject` row plus `feedback[]` (including reviewer names) — nodes with `notes`, `feasibilityNote`, Talkpush metadata, and all pages. If pinned, nodes/edges/pages are replaced with the version snapshot.
- Page `/workflow-share/[token]` → `WorkflowSharedView` (client component, fetches JSON after hydration): header, status pill, **Hide/Show #** toggle, sign-off panel, pinned-version banner, read-only React Flow (`nodesDraggable=false`, `elementsSelectable=false`), node detail card on click (label, type, actor, **notes**, **feasibility + feasibilityNote**), page tabs (read-only), `WorkflowLegend`, "Powered by Talkpush" footer. (`/shared/[token]` is **not** a workflow route — it is the *intake-form* share-link handler; `CODEBASE_SUMMARY.md` mislabels it. Do not port it.)
- `POST /api/workflows/[id]/feedback` (**public**, requires `shareToken`): `action ∈ {approved, changes_requested}`, free-text `reviewerName`, `comment` (required for changes), constant-time token compare, **in-memory** rate limit of 3 per workflow per hour (ineffective across serverless instances), snapshot + feedback row + `status = action` in one go.
- The shared view's node registry does **not** include `annotation` or `dangling_endpoint`; its edge normalizer drops `pathSemantic` and `waypoints`. **[V-code]** Result: annotation overlays and user-dragged connector routes will not render the same as in the editor. Verify visually.

## 8. API surface [V]
Auth legend: **S** = `requireAuth` (admin cookie JWT; authentication only, any admin passes) · **P** = public.
| Route | Verbs | Auth |
|---|---|---|
| `/api/auth/login`, `/logout`, `/session` | POST/POST/GET | — (login: in-memory IP rate limit 5/10 min) |
| `/api/workflows` | GET (list, `search`, `status`; node counts via raw SQL `jsonb_array_length`), POST (create, optional `templateId`) | S |
| `/api/workflows/[id]` | GET, PUT (partial: name, description, status, nodes, edges, viewport, pages), DELETE | S |
| `/api/workflows/[id]/share` | POST, PUT, DELETE | S |
| `/api/workflows/[id]/feedback` | POST | **P** (token) |
| `/api/workflows/share/[token]` | GET | **P** |
| `/api/workflows/[id]/versions` | GET (list), POST (manual snapshot) | S |
| `/api/workflows/[id]/versions/[versionId]` (+ `/restore`) | GET, POST | S |
| `/api/workflows/[id]/validate`, `/summary` | POST | S (summary uses Claude) |
| `/api/workflows/[id]/scoping-artifacts` (+ `/[artifactId]`) | GET/POST, PATCH/DELETE | S |
| `/api/workflows/[id]/canvas-inject` | POST (annotation overlays; `append` or `replace_annotations`) | S |
| `/api/workflows/generate` | POST (Claude) | S |
| `/api/workflows/templates` (+ `/[id]`) | GET/POST, DELETE | S |
| `/api/mcp` | GET (info), POST (JSON-RPC 2.0, MCP 2025-11-25) | MCP auth (§9) |
| `/api/mcp/workflows/**` | REST mirror of the node/edge/layout/renumber tools | S (cookie), **not** MCP auth |
| `/api/oauth/{authorize,token,register}`, `/.well-known/*` | OAuth 2.1 + PKCE + dynamic client registration for MCP | — |

## 9. MCP server (the "Lucid MCP replacement") [V] `src/mcp/*`, `src/app/api/mcp/route.ts`
- Server name `talkpush-workflow-builder`, version `1.5.0`, Streamable-HTTP JSON-RPC, protocol `2025-11-25`, `runtime = "nodejs"`, CORS `*`. `initialize` returns `instructions = workflowMcpSystemPrompt` (`src/mcp/system-prompt.ts`).
- **Auth accepted** (`src/mcp/http-auth.ts`): `?api_key=` / `?mcp_api_key=` query param vs `MCP_API_KEY` (≥32 chars); `Authorization: Bearer` = MCP OAuth access token, or admin JWT, or `MCP_BEARER_TOKEN`; or the `admin_token` cookie. OAuth scope `workflow:mcp`; PKCE S256/plain. **Security smell:** API key in the URL query string is logged by proxies/CDNs.
- **29 tools** (`src/mcp/server.ts`, handlers in `workflow-tool-handlers.ts`, 1,490 lines):
  - *Create:* `create_workflow_from_spec` (nodes/edges with `tempId`s, artifacts, summary, `autoLayout`, `layoutDirection`), `create_workflow_from_scoping_notes` (same + stores notes/transcript as a call-note artifact), `create_workflow` (empty), `create_from_template`, `duplicate_workflow`.
  - *Read:* `list_workflows`, `get_workflow` (nodes, edges, status, server-computed step numbers), `list_templates`, `get_template`, `list_versions`, `list_scoping_artifacts`.
  - *Edit:* `add_node`, `update_node`, `delete_node` (removes attached edges), `add_edge` (`isHappyPath` makes it the *only* happy edge from the source), `add_recovery_edge`, `auto_layout`, `renumber_steps`.
  - *Quality:* `validate_workflow`, `generate_customer_summary` (deterministic text from findings + artifacts), `add_scoping_artifact`, `update_scoping_artifact`, `delete_scoping_artifact`, `add_call_note`.
  - *Versioning/sharing:* `create_version_snapshot`, `restore_version`, `share_workflow` (explicit only — never auto-called).
  - *Canvas overlays:* `design_campaign_structure`, `clear_campaign_structure`.
- Spec flow in `persistWorkflowSpec`: temp-id mapping → edges (single happy edge per source) → `computeStepNumbers` → Dagre layout (unless `autoLayout:false`) → create project with one `Page 1` → artifacts → `validateWorkflow` → deterministic customer summary stored as an artifact → returns `{workflowId, editUrl, nodeIdMap, edgeIdMap, validation, numbering, summary…}`.
- **Gaps [V]:** no `update_edge`/`delete_edge`/`delete_workflow`; **no page parameter** (`getCanvas`/`updateFirstPage` only read/write `pages[0]`); no rendered-output verification tool; no invite/role/comment tools; MCP writes carry no revision check so they race with an open editor; tool-created edges always use `bottom→top` handles even after an LR layout.

## 10. AI generation [V]
`POST /api/workflows/generate` → Claude with `WORKFLOW_AI_SYSTEM_PROMPT` (Talkpush capability catalog: 12 autoflow actions, 5 campaign types, channels, scheduling, question types, platform constraints, integrations, portals). Hard caps: node label ≤ **40** chars, edge label ≤ **12** chars (enforced server-side by truncation + preserving the full label in `notes`). Rules: never invent a Talkpush feature (flag `needs_review`), one autoflow = one action, start with a source node, end with a terminal state, decision node for every branch. Output is normalized (`normalizeGeneratedNode/Edge`) and appended to the canvas.

## 11. Verified defects & UX/engineering findings in the source
Use this as the backlog seed. Format follows the `ux-audit` skill: **Confirmed** = observable in code; **Judgment** = design opinion.
| # | Finding | Concept violated | Confidence | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| F1 | Save failure shows only a transient toast; `"unsaved"` state renders no indicator; no `beforeunload` guard | Visibility of system status; error recovery | Confirmed | Users can leave believing work is saved; edits within the 2 s debounce are lost on tab close | Persistent status (Saving / Saved / **Not saved — retry**), `beforeunload` + `fetch keepalive`/`sendBeacon` flush, offline queue |
| F2 | Client view exposes internal `notes`, `feasibilityNote`, "Needs review" markers; legend text says "review before sharing with client" | Information hygiene / privacy | Confirmed | Internal assumptions and risks leak to clients | Server-side sanitization + `internalNotes` split (§12.3) |
| F3 | Public endpoint returns the whole workflow row (+ reviewer names of earlier reviewers) | Least privilege | Confirmed | Over-sharing; reviewer PII visible to other viewers | Purpose-built DTO per role |
| F4 | Anyone with the link can approve; reviewer name is free text; 3/hour in-memory rate limit | Identity, accountability | Confirmed | Approval is not attributable; limit is bypassable and can lock out real reviewers | Per-person invites, versioned approvals (§12) |
| F5 | Approval has no version FK; later edits don't reset status; live link shows changed diagram under "Approved" | Data integrity | Confirmed | "Approved" can be untrue | Bind approvals to a version; edits after approval mark "modified since approval" |
| F6 | No expiry, passcode, per-person revoke, or access log on share links | Access control | Confirmed | Can't retire one recipient | Per-person tokens + audit |
| F7 | Last-write-wins saves; editor never refreshes; MCP/other-tab edits are overwritten | Concurrency | Confirmed | Silent data loss — fatal once clients can edit | `revision` check + conflict dialog + presence |
| F8 | LR layout leaves `bottom→top` handles; UI Auto-arrange is TB only | Correctness | Confirmed | Horizontal diagrams look wrong | Layout engine owns handles (§16) |
| F9 | MCP can only touch page 1; no edge edit/delete tools | Capability gap | Confirmed | Claude can't fix multi-page or wrong edges | Add `page` and edge tools (§17) |
| F10 | Shared view lacks `annotation` node type and drops `pathSemantic`/`waypoints` | Fidelity (WYSIWYG) | Confirmed in code; **not visually reproduced** | Client sees a different diagram than the SE built | One shared renderer; viewer = editor in read-only mode |
| F11 | PDF is one A4-landscape page, active page only, no legend/version/author, no min font | Output quality | Confirmed | Large workflows unreadable; multi-page workflows incomplete — the very reason Jolo still uses Lucid + email | New export pipeline (§14.3) |
| F12 | Step numbering labels each node along a branch (`3a.1`, `3a.2`) | Convention mismatch with Lucid skill | Confirmed | Differs from Jolo's `5.1` branch-identity convention | Decimal scheme (§15.3) |
| F13 | Node color = node type; actor shown as small text | Visual encoding | Judgment | Readers can't spot "where a human is on the hook" at a glance | Actor-based fill (§15.1) |
| F14 | ~16 controls in one toolbar row; labels hidden below `xl`; ⌘K only adds nodes (no find) | Cognitive load, findability | Judgment (the count and the ⌘K behavior are Confirmed) | Hard to scan; no way to search a 100-node map | Group toolbar, add *Find node* and an outline view |
| F15 | Canvas "designed for desktop" banner on the **client** page | Responsive support | Confirmed | Clients open email links on phones/tablets | Mobile-first read-only viewer with outline mode |
| F16 | Workflow-level comment only; no node-anchored comments | Collaboration | Confirmed | Clients can only say "changes requested" in bulk | Anchored comments (§12.5) |
| F17 | Edge normalizer duplicated 6×, already divergent; `sanitizeText` ×5 | Maintainability | Confirmed | Drift causes F10 | Single module (§3.3) |
| F18 | No automated tests anywhere | Release safety | Confirmed | Numbering/layout/permissions regressions go unnoticed | Test strategy (§23) |
| F19 | MCP `api_key` accepted in URL query; `rejectUnauthorized:false` for prod DB SSL (`lib/db.ts`); login/feedback rate limits in memory | Security hygiene | Confirmed | Secrets in logs; weak TLS verification; limits ineffective on serverless | Header-only secrets; proper CA; durable rate limiting |
| F20 | `handleSave` ships active canvas twice (`nodes` + `pages[…]`) | Performance | Confirmed | 2× payload and storage | Patch/ops saves (§19) |
| F21 | MCP/template layouts never re-measured (`TODO` in code) | Layout quality | Confirmed | Overlaps for long labels | Measure server-side estimate + client re-measure on first open |

---

# PART B — WHAT TO BUILD

## 12. Roles, access, and client delivery

### 12.1 Objects and verbs (ux-plan step 1)
Objects: **Workflow** (pages, versions), **Page**, **Node/Edge**, **Version**, **Link** (view/comment/edit), **Member** (named invite), **Comment**, **Suggestion**, **Approval**, **Scoping artifact**, **Template**, **Export**.
Verbs by level:
- **Super Admin (owner):** create, import (MCP/AI/template), edit, validate, publish, create/rotate/disable links, invite, revoke, accept/reject suggestions, restore, export (internal or client-safe), approve-on-behalf (logged), delete.
- **Editor:** open, edit allowed content directly *or* in Suggesting mode (unless forced to suggest-only), comment, resolve own comments, approve/request changes (if allowed), export client-safe copy.
- **Commenter:** open, pan/zoom/search/outline, comment and reply, resolve own comments, export client-safe PDF.
- **Viewer:** open, pan/zoom/search/outline, click for details, export client-safe PDF; approve only if the link/invite has *Can approve*.

### 12.2 Permission matrix (enforce **server-side**; UI hiding is not security)
| Capability | Super Admin | Editor (direct) | Editor (suggest-only) | Commenter | Viewer |
|---|---|---|---|---|---|
| See workflow dashboard (all clients) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / duplicate / delete workflow | ✅ | ❌ | ❌ | ❌ | ❌ |
| View canvas (client-safe projection) | ✅ full | ✅ | ✅ | ✅ | ✅ |
| Edit nodes/edges/pages (allowed fields) | ✅ | ✅ | ➜ becomes a *suggestion* | ❌ | ❌ |
| Edit `internalNotes`, feasibility, node visibility, style, numbering | ✅ | ❌ | ❌ | ❌ | ❌ |
| Accept / reject suggestions | ✅ | ❌ (own: withdraw) | ❌ (own: withdraw) | ❌ | ❌ |
| AI Generate / MCP authoring | ✅ | ❌ | ❌ | ❌ | ❌ |
| See SE Brief, validation findings, gap-check | ✅ | ❌ | ❌ | ❌ | ❌ |
| Comment / reply / resolve own | ✅ | ✅ | ✅ | ✅ | ❌ (unless Jolo enables) |
| Approve / Request changes | ✅ (logged) | ✅ | ✅ | only with *Can approve* | only with *Can approve* |
| See version history | ✅ full | published versions list | published versions list | banner only | banner only |
| Restore version / change status / publish | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/rotate/disable links, invite, revoke | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export PDF/PNG/SVG | ✅ internal or client-safe | client-safe | client-safe | client-safe | client-safe |
| View audit log | ✅ | ❌ | ❌ | ❌ | ❌ |
"Anyone with the link" access is capped by the level of the link used; anonymous visitors are *Guests* (name self-declared on first open, flagged unverified).

### 12.3 Content visibility (the part most likely to leak)
- Add **`internalNotes`** (SE-only) next to `notes` (client-visible). Existing `notes` stays client-visible; **migrate nothing automatically** — surface a one-time "Review what clients can see" screen that shows each node's `notes`/`feasibilityNote` and lets Jolo move text to `internalNotes`.
- `feasibility`/`feasibilityNote` become **internal by default**, with an explicit per-workflow toggle "Show feasibility to clients".
- Add node-level `visibility: "client" | "internal"`. Internal nodes (and their attached edges) are removed from every client payload, export and MCP client-copy. This is the generalisation of the Lucid skill's rule "drop any `[LABEL]` internal-only shape entirely" [S].
- Never ship to clients: internal system identifiers (campaign IDs, autoflow set IDs, folder IDs, ticket numbers such as `SE-3685`, tenant subdomains), individual internal staff names in fault/escalation context (genericize to the team) [S `client_sanitization.md`]. Implement as (a) typed fields that are internal-only, and (b) a sanitization linter that flags regex hits (`SE-\d+`, UUID/cuid-looking ids, `*.talkpush.com` subdomains) for Jolo's review — do not auto-delete text.
- Keep as-is for clients: rejection-reason notes, message descriptions, tags, title/version/date [S].
- **Sanitization must be server-side** (a role-specific DTO). The client viewer must never receive internal fields and merely hide them.

### 12.4 Links, invites, and identity (Drive-style, copy-link only) — decisions D3, D4, D6
Principles: **zero account creation for clients**, no password system, no email infrastructure, per-link and per-person revocability, attributable actions.
1. **Three shareable links per workflow, like Drive's "view-only / can comment / can edit":** a *View link*, a *Comment link*, an *Edit link*. Each is independently **created, copied, rotated (old URL dies), disabled**, with optional **passcode** and **expiry** (default none; recommend 30 days for the Edit link). Edit links carry an *Editing mode*: **Direct** or **Suggest-only** (recommended default for the Edit link: *Suggest-only*; Jolo can change it).
2. **Named invites (per-person links)** for people Jolo wants to attribute and revoke individually: enter display name (+ optional email *as a label only*), pick **Viewer / Commenter / Editor**, optional *Can approve*, optional *Suggest-only*, optional expiry → system creates a unique link → **Copy link** button (the only delivery mechanism). Jolo pastes it into his own email/Slack/Teams.
3. **First open:** if the link doesn't already identify the person, ask for **display name** (+ optional email, flagged *unverified*) once; stored in a long-lived httpOnly cookie. Jolo's panel shows "Opened by Maria (unverified) · 2 h ago · Editor".
4. **General access settings** (the Drive pattern): *Restricted* (only named invites work) vs *Anyone with a link* (the three links above work). Default for a new workflow: **Restricted**; creating a link is one click and switches that link on.
5. **Request access (optional, no email):** an expired/revoked/disabled link shows a friendly page with *Request access* (name + email + message) which appears in Jolo's in-app inbox. Jolo then rotates/creates a link and copies it back manually.
6. **Revocation:** per link and per person; takes effect on the next request; shows a clear friendly page.
7. **Upgrade path (only if the host later gains email/identity):** verify email by one-time code; show "verified". Do not build passwords.
8. **Host reuse rule:** *inspect the host's auth first.* Map Super Admin onto the host's existing admin role; keep the guest mechanism separate. Never create a second staff login system.
9. Never put tokens in analytics events or `Referer`; send `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex` on viewer pages; store only **hashes** of tokens.
10. **Risk note for Jolo (plain English):** an *Edit link* is powerful — anyone who gets the URL can change the diagram (as a named guest). Mitigations built in: suggest-only mode, passcode, expiry, rotation, full audit, and Jolo can revert any person's changes. For sensitive clients use named invites rather than the shared Edit link.

### 12.5 Approvals, comments, and the review loop
- **Publish** is an explicit Super Admin action that snapshots a version and sets `publishedVersionId`. Clients see **the published version** by default (replacing "live link" as the default; "Live" remains an option for editors and for Jolo's convenience). The banner always shows "Version vN · published <date> by <name>".
- **Approval binds to a version.** `WorkflowFeedback` gains `versionId`, `memberId?`, `adminId?`. If a viewer approves while looking at a live (unpublished) state, snapshot first, then bind.
- **Edits after approval** (by anyone) set `status = "modified_since_approval"` (new value) and show Jolo a *Changes since approved v3* diff. The approved version stays immutable and viewable.
- **Anchored comments:** click a node/edge (or place a pin on the canvas) → thread with replies, resolve/reopen, author attribution, mentions optional. Super Admin sees an *Open comments* inbox per workflow and per client. Comments follow nodes across versions (store `nodeId`, `pageId`, `versionId` where created).
- **Notifications:** no email (D6). Jolo gets an **in-app activity feed / inbox** (new comments, suggestions waiting, approvals, access requests, link first-opened) with unread counts on the dashboard.
- **Audit log:** `WorkflowAuditEvent` for invite created/opened/revoked, edit sessions, publish, approve, export, restore, MCP actions (actor type `mcp` with the OAuth user).

### 12.6 Concurrency for Client Editors (non-negotiable once clients can write)
1. **Revision check.** Add `WorkflowProject.revision Int`. Every save sends `baseRevision`; server compares-and-increments atomically; mismatch → `409` with the latest revision + a three-way merge hint. The editor shows a **conflict dialog** (*Keep mine / Take theirs / Review differences*).
2. **Patch/ops saves** instead of whole-canvas PUTs (also fixes F20): `{ baseRevision, ops: [addNode, updateNode, moveNode, deleteNode, addEdge, updateEdge, deleteEdge, pageOps…] }`. Whole-canvas PUT remains for Super Admin import.
3. **Hidden-content merge rule (critical).** A Client Editor's client never receives internal nodes/fields (§12.3). A naive full-canvas PUT from that client would **delete** them. The server must apply the editor's ops onto the **full** canvas and reject any op touching internal nodes or protected fields. Add a test that proves an editor save never drops internal nodes.
4. **Presence (v1, cheap):** heartbeat every ~15 s to `/presence`; show "Maria is editing" chips and a soft banner "Jolo is also editing — changes will merge". Poll `revision` every ~10 s (and on window focus); if it advanced, show "New changes from X — Refresh" and auto-merge when the user has no unsaved ops. Realtime CRDT is **out of scope** (D7); design the ops format so it can be added later.
5. **Attribution:** every op batch records actor; versions created by client edits record `createdByName`/`memberId`; Super Admin can *revert this person's changes* by restoring or by reverting an op range.

### 12.6b Suggesting mode (Docs-style "suggest, then accept") — decision D4
- Editors see a mode switch **Editing | Suggesting** in the top bar (like Google Docs). A person or link can be **forced to Suggesting** by Jolo (`editMode = "suggest_only"`).
- In Suggesting mode **nothing changes on the live canvas.** Each action is recorded as an **op** (same op format as §12.6 — `addNode`, `updateNode`, `moveNode`, `deleteNode`, `addEdge`, `updateEdge`, `deleteEdge`, page ops) grouped into a **Suggestion** (auto-grouped per editing burst; the author can add a one-line summary).
- **Rendering of pending suggestions (everyone allowed to see them, incl. Jolo):** added nodes/edges = dashed green outline; deleted = red tint + strike-through label; edited text = inline old→new diff in the node detail card; moved = ghost outline at the proposed position. A **Suggestions panel** lists each suggestion (author, time, summary, *n changes*), with *Accept*, *Reject*, *Accept all from <author>*, and *Preview result*.
- **Accept** applies the ops through the normal revision-checked write path as the Super Admin, creating attributed history (`suggestedBy`, `acceptedBy`). If the base changed so an op no longer applies cleanly (node deleted, etc.), mark the suggestion **stale** and show *Re-apply what still fits / Reject*. **Reject** keeps it in history. The author can **withdraw** their own pending suggestions.
- Suggestions never touch internal nodes/fields (same hidden-content rule as §12.6.3).
- Commenters can reply on suggestions; Editors in Direct mode can also accept *other people's* suggestions only if Jolo grants *Can accept suggestions* (default **off**).
- Data: `WorkflowSuggestion` (§13). Keep suggestions out of the exported/published version until accepted.
- MVP guidance: ship direct editing + revision checks first; suggestions are Phase 2b but the **ops format must be designed in Phase 2** so both modes share it.

### 12.7 Client-facing viewer (what a Client Viewer/Editor sees)
- Route outside any admin shell, no admin chrome, branded header (client name, workflow, status, version banner), **light-weight bundle** (no editor code).
- Default view: **fit-to-screen** on the active page; page tabs; zoom/pan; **outline panel** (numbered step list, grouped by branch, searchable) that doubles as the accessible/mobile alternative to the canvas; **"Walk me through this flow"** step-by-step highlight mode (Next/Previous follows the happy path, branches listed).
- Click a node → detail card (label, role, action type, client-visible notes, comments). Search box → highlight/centre node.
- **Mobile/tablet:** replace the "desktop only" warning with a responsive layout: outline + pinch-zoom canvas; sign-off buttons sticky at bottom.
- Legend generated from what is actually on the diagram (§15.5).
- Download button: **client-safe PDF** (always sanitized), PNG, SVG.
- Sign-off panel (if allowed): Approve / Request changes with required comment; shows prior decision with name and version.
- Accessibility: keyboard navigation of the outline, `aria-label`s, color-independent meaning (tags + icons, not color alone), reduced-motion respect, 4.5:1 contrast.

## 13. Data model changes (additive, reversible) — **requires Jolo's approval before applying any migration**
```prisma
model WorkflowProject {   // existing fields unchanged; add:
  revision           Int       @default(0)
  diagramStyle       String    @default("classic")   // classic | process_map
  numberingScheme    String    @default("letters")   // letters | decimal
  publishedVersionId String?                          // supersedes shareVersionId semantics; keep shareVersionId for compat
  generalAccess      String    @default("restricted") // restricted | anyone_with_link
  showFeasibility    Boolean   @default(false)
  links              WorkflowLink[]
  members            WorkflowMember[]
  suggestions        WorkflowSuggestion[]
  comments           WorkflowComment[]
  auditEvents        WorkflowAuditEvent[]
}
model WorkflowLink {                 // the three Drive-style shared links
  id String @id @default(cuid())
  workflowId String
  level String                      // view | comment | edit
  editMode String @default("direct") // direct | suggest_only  (edit links only)
  canApprove Boolean @default(false)
  tokenHash String @unique
  passcodeHash String?
  expiresAt DateTime?
  disabledAt DateTime?              // rotate = create new row + disable old
  createdByAdminId String
  createdAt DateTime @default(now())
  @@index([workflowId, level])
}
model WorkflowSuggestion {
  id String @id @default(cuid())
  workflowId String
  authorMemberId String?
  authorGuestName String
  baseRevision Int
  ops Json                          // same op format as direct saves
  summary String?
  status String @default("pending") // pending | accepted | rejected | withdrawn | stale
  resolvedByAdminId String?
  createdAt DateTime @default(now())
  resolvedAt DateTime?
  @@index([workflowId, status])
}
model WorkflowMember {              // named invite (per-person link)
  id String @id @default(cuid())
  workflowId String
  level String                      // viewer | commenter | editor
  editMode String @default("direct") // direct | suggest_only
  canAcceptSuggestions Boolean @default(false)
  displayName String
  email String?
  emailVerified Boolean @default(false)
  canApprove Boolean @default(false)
  canComment Boolean @default(true)
  tokenHash String @unique    // store hash only
  expiresAt DateTime?
  revokedAt DateTime?
  firstOpenedAt DateTime?
  lastSeenAt DateTime?
  createdByAdminId String
  createdAt DateTime @default(now())
  @@index([workflowId])
}
model WorkflowComment {
  id String @id @default(cuid())
  workflowId String
  pageId String
  nodeId String?
  edgeId String?
  x Float?  y Float?
  versionId String?
  parentId String?
  body String
  authorAdminId String?
  authorMemberId String?
  authorName String
  status String @default("open")   // open | resolved
  createdAt DateTime @default(now())
  resolvedAt DateTime?
  @@index([workflowId, status])
}
model WorkflowAuditEvent {
  id String @id @default(cuid())
  workflowId String
  actorType String          // admin | member | guest | mcp | system
  actorId String?
  actorName String?
  action String
  detail Json @default("{}")
  createdAt DateTime @default(now())
  @@index([workflowId, createdAt])
}
// WorkflowFeedback: + versionId String?, memberId String?, linkId String?, adminId String?
// WorkflowAccessRequest (optional): id, workflowId, name, email, message, status, createdAt
// WorkflowVersion:  + revision Int?, createdByMemberId String?
// status: add "modified_since_approval"
```
Node `data` additions (JSON, no migration needed): `actionType`, `personActs`, `internalNotes`, `visibility`, `branchNumber` (computed, never stored), terminator `endKind`, jump `targetStep`, note `noteKind`. Edge `data` additions: `fork.anchor`, `join: { edgeId, at }`.
Migration safety: every column nullable or defaulted; no drops; backfill nothing automatically; keep `nodes/edges/viewport` legacy columns until a later, separately approved cleanup. Host DB may not be Postgres/Prisma — adapt, but keep the same logical model.

## 14. Sharing & export that replace "Lucid + PDF by email"

### 14.1 Share dialog (redesign — modeled on Google Drive's Share dialog)
Sections, top to bottom:
1. **People with access** — Jolo (Owner) plus each named invite with a level dropdown (*Viewer / Commenter / Editor*), *Suggest-only* and *Can approve* toggles, last opened, **Copy link**, **Remove**. Button **+ Invite person** (name, level, → creates and copies link).
2. **General access** — *Restricted* / *Anyone with a link*. When on, three rows appear: **View link · Comment link · Edit link**, each with a **Copy link** button, an on/off switch, *Rotate*, *Passcode*, *Expiry*, and (Edit) *Direct / Suggest-only*. A one-line plain-language caption under each ("Anyone with this link can look but not change anything").
3. **What clients see** — *Published vN* or *Live*; *Show feasibility to clients* toggle.
4. **Preview as…** — *Viewer / Commenter / Editor (direct) / Editor (suggesting)* opens the real client page in an impersonation preview with a banner (best defense against leaking internal content).
5. Footer: **Copy link** (primary, uses the currently selected row) and **Done**. After copying, show a toast "Link copied — paste it into your email."

### 14.2 Exports (all runnable by Super Admin; client-safe by default for clients)
| Format | Notes |
|---|---|
| **PDF (client deck)** | Cover (client, workflow, **version**, date, author), one page per workflow page, **page size matches the diagram aspect ratio** (single page per diagram, vector, no minimum-font violation; cap at A2/A1 and warn), optional "print tiled A4", legend page, **flow table appendix**, open-questions list (client-visible artifacts only). Filename convention [S]: `[Client] [Process] - [Description] (vN-change-summary).pdf`. Embedded fonts. |
| **PNG / SVG** | Per page, 1×/2×/3×; SVG preserves text. |
| **Flow table CSV/XLSX** | Step · Actor · Action · Action Type · Branch/Condition (§18.1). |
| **Mermaid** | Existing; keep. |
| **JSON** | Full-fidelity import/export for backup and MCP round trips. |
Rendering must come from **one renderer shared by canvas, viewer and export** to end the drift in F10/F11 (prefer SVG-based rendering of the same node/edge components, or a shared pure "scene → SVG" function). Do not maintain a second drawing implementation.

### 14.3 PDF quality bar (acceptance)
Text selectable; no clipped labels; legend and title block present; badges don't overlap text; connectors never cross unrelated shapes (§16.3 linter); a 60-node, 3-page fixture exports in < 5 s on a laptop and < 1 MB.

## 15. The "Process Map" visual system (port of the Lucid skill)

**Goal:** a selectable style, `diagramStyle = "process_map"`, that reproduces Jolo's Lucid output: same shapes, colors, tags, icons, numbering, legend, title block, and cleanliness. "Classic" remains for existing workflows. Everything below marked [S] is from `talkpush-agent-lucid-workflow` (SKILL.md, `visual_system.md`, `flow_table.md`, `branch_numbering.md`).

### 15.1 Shapes & colors [S]
| Meaning | Shape | Fill | Stroke |
|---|---|---|---|
| System does it, **no person needed** | Rectangle (process) | `#C8E6C9` | `#333333` solid |
| **A person acts** (role in brackets) | Rectangle | `#FFFFFF` | `#333333` solid |
| Decision / outcome | Diamond | `#BBDEFB` | `#333333` solid |
| True start | Rounded oblong, white | `#FFFFFF` | `#333333` |
| True end | Rounded oblong; **success = dark green `#2E7D32`** (white bold text), **failure/rejected = pink `#EF9A9A`**, **neutral/manual hand-off = light gray `#ECEFF1`**, soft-success (e.g. "Nurture (End)") = light green `#C8E6C9` | per kind | `#333333` |
| On-page jump / rejoin | Small circle (e.g. "→⑧") | `#E1BEE7` | `#6A1B9A` solid |
| Annotation / note | Dashed rectangle | `#FFF9C4` | `#666666` dashed |
| Rejection reason | Pink dashed rectangle | `#FFCDD2` | red dashed |
| Needs-input ("To confirm with [Client]" / "Needed from [Client]") | Orange dashed rectangle | `#FFE0B2` | orange dashed |
| Out of scope | Light-gray dashed rectangle | `#ECEFF1` | gray dashed |
**Fill follows the actor, never the tag** (Jolo's rule, 2026-10-02) [S]:
- No person needed → green. A person acts → **white** even if the step also writes data, moves a folder or sends a message.
- Mixed step (person acts, then the system does something) → white, one box, add a sentence "The system then …". Never split into two boxes; never renumber for it.
- **Every white box starts with the acting role in capitals in brackets**, in the client's words: `[REPORTER]`, `[HANDLER]`, `[HANDLER, then LEAD]`, `[RECRUITER]`, `[HIRING MANAGER]`, `[CANDIDATE]`. Never a generic `[PERSON]`/`[MANUAL]`. **Every white box carries the people-icon badge.** Decision diamonds stay blue and untagged.
- If it is unclear who performs a step: **ask**, don't guess the color.
Mapping from today's data: `actor ∈ {manual, candidate}` → `personActs = true` (white); `automated | integration | source` → green; add an explicit `personActs` override for mixed steps. `actorLabel` becomes the bracketed role (uppercased). `decision` → blue diamond; `source` → start terminator; new `terminator` kind for ends.

### 15.2 Bracket tags + icon badges (strict 1:1 with Action Type) [S]
Put the **Action Type** on `node.data.actionType`; the first bold line of the shape reads `<step numeral> [TAG]` (e.g. `③ [MOVE]`). A genuinely manual step or a decision carries **no tag**. Full table in **Appendix A**. Icons: Jolo's skill uses Azure icons from Lucid; **use `lucide-react` equivalents** (proposed mapping in Appendix A). Rules to preserve: icon badge sits **outside** the box, above its top-left corner, 40 px tall, never touching text; rejection-reason note shares the `[Add Data]` tag icon; decisions, terminators, other notes and jump markers carry no badge; **render candidate icons before committing** (known failure mode 14: names mislead).

### 15.3 Numbering (replace "3a.1" with Jolo's convention) [S]
- Circled numerals ①②③… on the **main spine only**, in the first text line. Beyond ⑳ use ㉑–㊿ then `(51)`.
- Branch numbering **on by default** wherever a decision forks. **The number identifies the branch, not the position in a chain**: decision ⑤ forking two ways → branches **5.1** and **5.2**; *every* shape in that branch's chain carries `5.1`. A deeper decimal only appears when a shape inside the branch is itself a forking decision (`10.1` → `10.1.1`, `10.1.2`).
- **Never number a terminator.** Fork connector label carries the number (`"5.1 · Declines"`); shapes show it small and muted inline after the tag (`<b>[MOVE]</b> <span style="font-size:7pt;color:#757575">5.1</span>`) — never on its own line.
- Editing the spine renumbers every downstream branch **as part of that edit** (satisfied automatically because numbering is computed at render time; keep it that way and add golden tests).
- Implementation: new function `computeDecimalNumbers(nodes, edges)` beside the existing one, selected by `numberingScheme`. Spine = chain of `isPrimary` edges from the entry to the main terminal. Branch order at a fork: by target's vertical stacking then x (left→right) so labels read naturally.

### 15.4 Containers, title block, one page [S]
Two containers: an **entry container** on the left ("Candidate Entry"/equivalent) and a main **"[Process Name] Journey"** container holding the spine and every branch. **Always one page** per diagram (no mandatory splitting). Title block: bold 16 pt title, then a 9 pt metadata line `vN · date · author` — never an explanation of conventions inside it (failure mode 1). Auto-generate from workflow metadata and the current version; rename must update both title block and document name (failure mode 18).

### 15.5 Legend ("Diagram key") [S]
Auto-generated, not hand-built: a container titled **Diagram key** with rows exactly: green "System does it, no person needed"; white "A person acts (role in brackets)"; blue "Decision"; yellow dashed "Note"; purple "Jump to another step"; plus rows for any other shape kind actually present (pink "Rejection reason", orange "To confirm with <Client>", gray "Out of scope", "Screen the reporter sees", "Log or record"). **The key does NOT list bracket tags or their icons** (Jolo decision, 2026-10-03; this overrides the Lucid skill). Rows appear only for kinds used on that diagram. Placed in empty space below the entry container, not stacked below the main flow. Keep it lean.

### 15.6 Annotation semantics [S]
Notes are never steps the flow executes through. Types: info (yellow dashed), rejection reason (red dashed), needs-input (orange dashed — used instead of inventing a path when routing is unknown). Place notes **beside** a shape, never directly in its own downstream connector lane (failure mode 7).

### 15.8 Ground truth from Jolo's two reference diagrams (measured 2026-10-03)
Source files: *MyPal Proposed Flow Oct 2 2026.pdf* (McDonald's PH, **v3**, newer conventions) and *Teleperformance PH pilot journey v5.pdf* (**v5.1**, older legend wording and no icon badges). Both are single-page vector PDFs of **3219×868 pt** and **3006×787 pt** — an aspect ratio of about **3.7:1 to 3.8:1** — which confirms that exports must use a **custom page size matching the diagram**, not A4. Colors below were **sampled from a 144-dpi render** (not eyeballed); sizes are ratios because the PDFs are scaled.

**Measured colors** (match §15.1/Appendix B)
| Element | Measured |
|---|---|
| System step fill | `#C8E6C9` (stroke dark gray/black ~1 px) |
| Decision fill | `#BBDEFB` (from the skill; sampled pixel landed on text) |
| Jump marker fill | `#E1BEE7`, purple stroke |
| Note (yellow) | `#FFF9C4`, thin amber dashed stroke |
| To confirm / Needed from [Client] | `#FFE0B2`, orange dashed stroke, **bold first line** then body |
| Rejection reason | `#FFCDD2`, red dashed stroke |
| End — success | `#2E7D32` with white bold text |
| End — failure | `#EF9A9A` |
| End — neutral / out of scope note / table header | `#ECEFF1` |
| Container tab label (title above the container) | mid-gray tab (≈`#8A8A8A` family) with dark text, rounded container border light gray |
| Highlighted table cell ("still to confirm") | `#FFE0B2` |

**Proportions (render pixels at 144 dpi, use as ratios):** process box ≈ 180×135 (4:3); decision ≈ 195×125; start/end terminator ≈ 180×62 (≈2.9:1); jump circle ≈ 64 diameter (≈ 0.35 × box width); icon badge ≈ 35–40 px tall (≈ 0.2–0.25 × box width), sitting just above the box's top-left; horizontal spine gap between boxes ≈ 0.5 × box width; vertical drop from decision to first branch box ≈ 0.45 × box height + label room. Body text is small and uniform; edge labels ("3.1 · No", "Yes") are visibly **larger than box text**; title block above the first container reads `Title` / `vN · YYYY-MM-DD · Author`, centered.

**Shapes and conventions present in the diagrams but *not* spelled out in the skill — add them to the module:**
1. **Container tab titles:** gray rounded tab label above each container ("Candidate Entry", "Diagram key", "[Process] Journey"). A page may hold **two main containers side by side** (Teleperformance: the pilot journey plus *"Show Up Tracking (proposed)"*). Append **"(proposed)"** to a container title for not-yet-agreed scope.
2. **Display shape** (angled left edge, rounded right) = *"Screen the reporter sees"* (MyPal ⑤). **Cylinder** = *"Log or record"* (legend only). **Document shape** (wavy bottom) = an outbound message artefact (MyPal ⑬). Treat as optional shape kinds with legend rows that appear only when used.
3. **Data table inside the diagram** (title in bold above, small subtitle line, gray header row, black grid) — MyPal "Success metrics", Teleperformance "Candidate message cadence". The cadence table also uses **cell-level orange highlight** to mark cells still to confirm. The existing `table` node needs: caption/subtitle, header fill `#ECEFF1`, per-cell highlight state, and a legend entry.
4. **Out-of-scope note:** light-gray dashed note ("Out of pilot scope") with a legend row; the legend wording is client-specific for the orange row — **"To confirm with <Client>"** — so legend labels must be templated from `clientName`.
5. **Neutral end state:** gray terminator "Manual follow-up (End)"; soft-success terminator "Nurture (End)".
6. **Entry jump marker:** a purple circle with text like *"⑪ · Leads from step #5.1"* feeding into a spine step (the mirror of "→ Go to step ⑪").
7. **Branch-label format:** `<branch number> · <outcome>` on the connector ("2.1 · Anonymous", "11.1.1 · Replies"); the same number appears small and muted after the tag in the shape's first line (`[REPORTER] 2.1`). Spine decision outputs use plain labels (Yes / No / Valid / Answered / Interested). Numbering reaches three levels (`11.1.1`, `8.1.2`).
8. **In-box typography:** bold tag + bold circled numeral on the first line, body below; **italic last line for timing/cadence** ("Day before the interview", "Daily"); notes use a **bold heading line** ("To confirm with …", "Needed from …", "Note", "Out of pilot scope").
9. **Role tags actually used:** `[REPORTER]`, `[HANDLER]`, `[HANDLER, then LEAD]`, `[SUPER ADMIN]`, `[CANDIDATE]`, `[MANUAL]` (Teleperformance v5.1, *before* the actor rule), plus **`[ALERT]`** (MyPal ⑩, a system email to a handler, drawn with the message icon). **Decision: `[ALERT]` is now a real tag** (15th) with its own Action Type — see Appendix A.
10. **Icon badges seen:** people (cyan) on every white box in v3, tag (purple) on `[Add Data]` and `[REJECTION REASON]`, chat-with-phone (purple) on `[MESSAGE]`/`[ALERT]`, gear (cyan) on `[SYSTEM]`. The Teleperformance v5.1 file has **no badges** and a legend that still says "Automated system step / Manual step" — i.e. it predates the 2026-09-30 and 2026-10-02 rules; **MyPal v3 is the style target**.
11. **Diagram key content as actually shipped (v3):** green "System does it, no person needed"; white "A person acts (role in brackets)"; blue "Decision"; pink "Rejection reason"; orange "To confirm with <Client>"; yellow "Note"; purple "Jump to another step"; plus "Screen the reporter sees" and "Log or record" (shape rows). **No tag/icon rows — this is the confirmed target** (Jolo decision), so §15.5 follows it.
12. **Density reality check:** these diagrams carry 25–40 shapes plus a table on one wide canvas with some boxes holding 40+ words. The layout engine must stay legible at that density and the viewer must default to **fit-to-width with pan/zoom and the outline panel**, because the full page is ~3.8× wider than tall.

### 15.7 Crosswalk: Lucid skill → today → target
| Lucid skill rule [S] | In the source repo today [V] | Target |
|---|---|---|
| Fill by actor | Fill by node type | `personActs`-driven fill (Process Map) |
| 15 bracket tags + icons (incl. `[ALERT]`) | `talkpushAction` (12 autoflow keys) only; no tag/icon | `actionType` taxonomy (Appendix A) |
| Terminators (Hired/Rejected) | Terminal inferred from label text | Explicit `terminator` node + `endKind` |
| Jump markers | None | `jump` node/edge style |
| Circled spine numerals + decimal branch ids | `1, 2, 3, 3a, 3a.1, 3r` | `numberingScheme: decimal` |
| Horizontal spine, branches drop below | Dagre TB/LR, generic | Spine layout engine (§16) |
| Legend / diagram key | Static legend of node types/actors/feasibility | Generated key (§15.5), color/shape rows only, no tag icons |
| Title block with version/date/author | None on canvas; PDF header lacks version/author | Generated title block |
| Flow table approved before building | None | Flow-table review gate (§18.1) |
| TA/BPO gap check, severity tiers | Structural validation only | Gap check (§18.2) |
| Client sanitization | None | §12.3 |
| Verify rendered output, never trust `success:true` | n/a | `render_preview` + geometry linter (§16.3, §17) |
| "Master file wins" after handoff | n/a (this tool *is* the master) | Version diff + "changes since approved" |

## 16. Layout engine v2 ("spine layout") — port the Lucid *geometry* rules [S `lucid_technical_notes.md`]

Purpose: deterministic, readable maps with no hand-tuning. Applies to `process_map`. Keep Dagre for Classic.

### 16.1 Rules to implement
1. **Spine:** main path on **one straight horizontal row** left→right to the main end state. Branches drop **vertically** below (or above) their decision using **elbow** connectors only (no diagonals).
2. **Center a branch cluster under its decision.** Lay out the branch(es) at a local origin, then shift the group so the **average center of the branch's first shapes** (not the cluster bounding box, which notes skew) equals the decision's center → a single branch drops dead-straight; multiple branches get small even jogs. Fall back only as far as needed to avoid overlapping the previous cluster. (failure mode 9)
3. **Fork anchors:** 2+ structurally parallel exception edges from one decision share the same exit anchor (bottom-center) and the same `lineType` (`step`/elbow). A plain continuation is *not* part of that group and exits toward its next step (failure mode 8, 5).
4. **Merges:** a real merge = one **trunk** edge into the shared terminal, straight and centered under the trunk branch alone, plus **joins** from other branches that attach to a point (`at ≈ 0.7–0.8`) *along the trunk path* with an arrowhead. Implementation hint: an invisible **junction node** on the trunk (generalize `DanglingEndpointNode`), splitting the trunk into two edges. Each additional join uses a different `at`. (failure mode 10)
5. **Keep merges local:** reuse a shared terminal only for branches whose sources are close; for sources far apart, create a **local terminal with the same label** instead of a long cross-page edge (failure mode 6).
6. **Keep a step's own downstream lane clear:** notes sit beside, never in the lane (failure mode 7).
7. **Entry container alignment:** the entry shape shares the spine row's y-center (failure mode 11).
8. **Vertical gap in stacked branch chains ≥ 100 px** so a 46 px badge never sits on the connector above it.
9. **Container padding ≥ 80 px** around children (union of child boxes + padding).
10. **Label clearance:** label width ≈ `7 × chars + 20`; a horizontal connector's clear span ≥ `labelWidth + 40`; stagger label positions (0.3/0.5/0.7) where connectors converge; two nearby connectors never share identical label text.
11. **Text fit:** shapes of one visual class share one bounding box; budget `charsPerLine = floor((width − 32)/7)`, `height = 32 + 18 × renderedLines`. Don't let text auto-shrink (over- or under-sized boxes make type inconsistent — failure mode 2). In the browser, **measure real DOM sizes**; on the server use the formula.
12. **Diamond margin:** diamonds need extra margin beyond the rectangle formula (usable text area is smaller).
13. **Handles:** the engine **sets `sourceHandle/targetHandle`** per edge (spine → right→left; branch drop → bottom→top), fixing F8.
14. **No assisted re-layout after the user drags:** user position changes win; "Re-run layout" is an explicit action; show a diff preview (*Apply / Cancel*) before overwriting hand-tuned positions.

### 16.2 Defaults to tune (now grounded in Jolo's two PDFs — see §15.8 for ratios)
Use the **proportions in §15.8** (box 4:3, decision ≈ 1.55:1, terminator ≈ 2.9:1, jump circle ≈ 0.35 × box width, badge ≈ 0.2–0.25 × box width, spine gap ≈ 0.5 × box width). For absolute sizes keep the skill's working numbers as the base unit (≈240×90 process box, 40 px badge) and **render both reference diagrams with the new engine as acceptance fixtures**: the output should be visually indistinguishable in structure (same spine, same branch drops, same jump placement) even though pixel positions differ.

### 16.3 Geometry linter (new; closes the gap Lucid's validator left)
Lucid's validator did not check elbow connectors, so a clean report still produced tangles; the skill requires opening the render. Build `lintLayout(scene)` that routes every connector orthogonally and reports: connector crossing a non-endpoint shape; connector through a note; label–label or label–shape overlap; clearance < 60 px; badge overlapping text/connector; text exceeding the box budget; diagonal segment; fork group with mixed line types; far-travel merge; entry/spine y-mismatch; container padding < 80. Run it inside `validate_workflow`, expose it in the UI as **"Layout check"**, and make it a **CI test over golden fixtures**. This is the automated form of the skill's self-audit checklist.

## 17. MCP v2 & the replacement skill

### 17.1 Keep, change, add
| Area | Change |
|---|---|
| Compatibility | Keep all 29 existing tool names/shapes working; additive params only |
| Pages | `page` (id or name) on `get_workflow`, `add_node`, `update_node`, `delete_node`, `add_edge`, `add_recovery_edge`, `auto_layout`, `renumber_steps`, `validate_workflow`; new `list_pages`, `add_page`, `rename_page`, `delete_page` |
| Edges | New `update_edge`, `delete_edge` (label, pathSemantic, lineType, waypoints reset) |
| Flow table | `get_flow_table(workflowId)` (derive Step/Actor/Action/Action Type/Branch), `create_workflow_from_flow_table(table, options)` (builds **only after** the table was approved — see §18.1), `propose_changes(workflowId, diff)` → returns a plain-language diff for approval |
| Quality | `run_gap_check` (§18.2), `lint_layout` (§16.3), `validate_workflow` returns both structural + layout + sanitization findings with severities |
| Verification | `render_preview(workflowId, page?, region?, format: png\|svg, audience: internal\|client)` returns an image so the agent can **look** (never trust `success:true` — failure modes 4, 16). Needs a server-side render path; evaluate options and **request approval before adding a dependency** (§22) |
| Versions | `diff_versions(a, b)` plain-language + structural; `publish_version(workflowId, versionId?, label?)` |
| Style | `set_diagram_style(workflowId, style, numberingScheme)` |
| Sharing & review | `list_access`, `create_link(level, editMode, passcode?, expiry?)`, `rotate_link`, `disable_link`, `invite_person(name, level, …)`, `revoke_person`, `list_suggestions`, `accept_suggestion`, `reject_suggestion`, `list_comments` — **sharing tools are never auto-called; descriptions must say "only on explicit user instruction"** (keeps today's rule for `share_workflow`). Tools return the **link URL for the user to copy** (no emails). |
| Concurrency | Every mutating tool takes optional `baseRevision`; the server snapshots a version **before any bulk AI edit** (Lucid failure 12: don't overwrite hand edits) |
| Auth | Header-only secrets (remove `api_key` query support or restrict to a revocable, scoped dev key); scopes `workflow:read`, `workflow:write`, `workflow:share`; log every call to the audit table with `actorType: "mcp"` |
| Prompt | Replace `workflowMcpSystemPrompt` with the rules in §18 and Appendix C |

### 17.2 Replacement Claude skill (deliverable)
Produce `SKILL.md` (+ `references/`) named e.g. `talkpush-agent-workflow-builder` by **adapting** the Lucid skill: remove Lucid-specific mechanics (Standard Import JSON, `lucid_*` tools, assisted layout, HTML-in-text constraints, master-file paste rules) and keep the *behavioral* content: who the skill is for ("never guess" routing to Clara-ai/Nairi, Replit, engineering, the client), visual system, branch numbering, **always table-then-approve**, TA/BPO gap check, sanitization, self-audit checklist (converted to `lint_layout`/`run_gap_check` calls), naming convention, handoff to CRM configuration planning. Map each Lucid step to the new tools. Apply Jolo's two overrides of the Lucid skill: add the `[ALERT]` tag (15 tags) and drop tag icons from the Diagram key. Keep the "living document" rule (extend reference files, version-history table at the bottom).

## 18. Authoring guardrails (build into the UI *and* the MCP/AI path)

### 18.1 Flow-table approval gate [S `flow_table.md`]
Before any diagram is built or structurally changed by AI/MCP, show a **proposed flow table** and require explicit approval (UI: *Review flow* step with *Approve & build*; MCP: the agent must present it in chat and call `create_workflow_from_flow_table` only after a "yes"). Columns: **Step · Actor · Action · Action Type · Branch/Condition**. `Actor` ∈ {Candidate, Talkpush, Recruiter, Referrer/Vendor} — flag it if a flow needs a different vocabulary; don't invent a fifth silently. `Action Type` is blank for decisions and genuinely manual steps. Candidate-actor steps are `[CANDIDATE]` even when AI/system facilitates (open precedence question vs `[AI]` for a true AI-conducted interview — ask Jolo when it arises). Classify an integration step by which side of the boundary it does (transfer vs internal read/write); two steps if both are needed. **Do not assume something described in passing is decorative** — recruiter round-robin assignment looked like an annotation and was a real `[Add Data]` step (skill history 2026-09-19). Make the table editable and exportable; keep it in sync with the diagram (strict 1:1 between tag and Action Type).

### 18.2 TA/BPO gap check [S `ta_domain_gap_checks.md`]
Output as scoping artifacts with tiers: 🔴 **Blocker** (list and stop), 🟡 **Assumption needed** (state as "Assumed [thing] because [reason]. If incorrect, [what changes]."), 🟢 **Nice to know**. Emoji/tiers are for the SE-facing summary, **never** text inside a diagram shape. Checks:
- *Structural:* trigger ambiguity; decision criteria missing; integration handoff mechanism; ownership gaps; dead-end branches; parallel vs sequential ambiguity; timezone/locale signals.
- *Operational:* volume unknown; SLA/turnaround missing on manual steps; missing exception paths (API failure, candidate ghosting, recruiter inaction, downtime, partial data); scale risks (sequential human approvals, one-at-a-time integration calls, no bulk path); **loops with no cap** (recommend max retries, cooldown, auto-disposition).
- *Compliance/consent:* AI disclosure (Voice AI), recording consent, data-privacy consent (APAC: PH/SG/KR differ), right to withdraw, consent captured too late.
- *Talkpush patterns (ask if the process type normally has them and they're missing):* prescreening drop-off recovery (1H/3H/24H/36H/48H/72H → Unresponsive after 15 days → Rejected after 30), AI-interview drop-off, self-scheduling no-show recovery (48H reminder, booking writes back), attribute-driven vertical routing (readiness attribute set last), reprofiling (often capped at 3), round-robin assignment, job-offer disposition via Job Offer Status attribute, channel ownership/cooling period (commonly 90/30 days — **confirm per client**, e.g. Concentrix PH 30-day override).
- Ask at intake whether the diagram is **internal** or **client-facing**; that decides whether sanitization applies.
Each check is a deterministic rule where possible (e.g. retry loop without a counter, wait node with no duration, Voice AI node without a preceding disclosure/consent node) and an LLM-assisted prompt otherwise; always labeled with confidence.

### 18.3 Failure modes to turn into automated checks [S `known_failure_modes.md`]
| # | Failure mode | Automated guard |
|---|---|---|
| 1 | Prose crammed into a small shape (e.g. title meta line) | Title meta char budget |
| 2 | Number added to an already dense shape → text shrinks | Text-fit lint after numbering |
| 3 | Numbering applied to terminators | Numbering test: terminators never numbered |
| 4, 16 | Trusting `success:true` / in-place edits change look | `render_preview` + post-edit lint; explicit font size |
| 5, 8 | Mixed/forced line types at forks | Fork-group lint |
| 6 | Distant branches into one shared terminal | Far-merge lint |
| 7 | Note in a connector lane | Lane-obstruction lint |
| 9 | Cluster packed from decision's left edge | Layout test: single-branch drop is vertical |
| 10 | Merge built as independent connectors | Merge-structure lint (trunk + join) |
| 11 | Entry container centered on itself | Entry/spine y-center lint |
| 12 | Treating own last build as current | Never overwrite: snapshot + diff before AI edits |
| 13 | Automatic folder move tagged `[SYSTEM]` | Action-type rule: folder moves are `[MOVE]` |
| 14, 17 | Icon chosen by name / prints library name | Icon visual regression snapshot |
| 15 | Colored by tag instead of actor | Fill derived from `personActs` only |
| 18 | Renamed term/version left behind | Term-sweep: when a label term is renamed, list all remaining occurrences across nodes, notes, tables, legend, artifacts; version change updates title block and workflow name together |

## 19. UX, information architecture, and performance upgrades

### 19.1 Information architecture (ux-plan)
- **Super Admin shell:** `Workflows` (dashboard: search, status, client grouping, *Needs attention* = open comments / changes requested / modified-since-approval) → **Workflow** (tabs: *Canvas*, *Flow table*, *SE Brief*, *Review* (comments + approvals), *Versions*, *Share & access*). Add **client grouping** (a workflow list grouped by `clientName`) and a client "home".
- **Client shell:** single workflow page (viewer/editor) — no navigation beyond page tabs.
- Terminology: pick one name per concept and use it everywhere (e.g. "Published version", "Invite", "Approve", "Request changes"); keep the legend, outline, tables and exports consistent (failure mode 18).

### 19.2 Editor UX (ux-design) — recommended changes
| Area | Change | Rationale |
|---|---|---|
| Toolbar | Group into: **File** (rename, versions, export), **Edit** (undo/redo, select/pan), **Arrange** (layout check, re-run layout, renumber), **View** (layers, minimap, outline), **Share**. Primary action = Share/Publish; AI Generate moves into a *New content* menu | ~16 flat controls today; reduce decision load |
| Save state | Persistent chip: *Saving… / Saved / Not saved — retry*; unsaved-changes guard | F1 |
| Find | `⌘K` becomes a real palette: *Add node*, *Go to node/step*, *Run command* | F14 |
| Outline | Left panel tab *Outline* (numbered steps, filter by role/tag/feasibility) | findability + accessibility |
| Properties | Replace free-text `actorLabel` with **Role** (autocomplete from roles already used) and **Action type** select; show "Person acts?" switch with the derived color preview | feeds Process Map rules |
| Mixed steps | Inline hint "Add 'The system then …' sentence" when `personActs` and system actions both present | Lucid rule |
| Destructive actions | Delete page/node uses undo-toast (Undo 8 s) instead of two-click confirm where reversible; restore version keeps confirm | recoverability |
| Empty & error states | Friendly revoked/expired link page; conflict dialog; offline banner | completeness |
| Microcopy | Plain language, no jargon in client views (e.g. "autoflow" → "automated step" if Jolo agrees; **ask**, don't decide) | [S] client_sanitization "flag and ask" |
| Keyboard | Document shortcuts in a `?` sheet; add `F` fit, `L` layout check | discoverability |

### 19.3 Performance (nextjs-vercel-performance-optimizer) — measure first, then fix
Targets (recommendations **[J]**; verify with React Profiler on a 150-node fixture and Lighthouse/Web Vitals on the viewer):
1. **Split the monolith.** `WorkflowEditor.tsx` (3,735 lines, ~50 hooks in one component) → feature slices (canvas, toolbar, panels, history, save, share) with stable props; `React.memo` the panels; avoid recomputing `computeStepNumbers`/`renderNodes` on every drag tick — recompute on drag-stop or when a topology signature (ids, edges, `isPrimary`, branch ordering keys) changes (`rerender-derived-state`, `rerender-memo`).
2. **Code-split by role.** The client viewer must not import editor code (`next/dynamic` for editor, `AIGenerateModal`, `VersionHistory`, `SEBriefPanel`, command palette; jsPDF already dynamically imported — keep). Import lucide icons by name only (no barrel) (`bundle-barrel-imports`, `bundle-dynamic-imports`).
3. **Kill the viewer waterfall.** Today: HTML → JS → client `fetch` → render. Make the viewer route a **server component** that resolves the token, builds the role-specific DTO, and passes minimal serialized props; stream the page shell (`server-serialization`, `async-suspense-boundaries`). Do not cache across tokens/roles.
4. **Payload diet.** Patch/ops saves; drop the legacy-column mirror from the wire (server may still mirror); stop shipping `pages` + `nodes`/`edges` together (F20). Gzip large JSON; trim list endpoints (already done for the dashboard).
5. **History memory.** 20 full snapshots × large canvases is heavy; store structural-shared patches or cap by size.
6. **Parallelize server work** in route handlers (`Promise.all` for independent Prisma reads), keep Prisma `select` minimal (already good on list).
7. **Single PDF engine** (drop whichever of jsPDF/@react-pdf the new pipeline doesn't need).
8. **Rate limiting** must be durable (Redis/Upstash/DB) rather than per-instance memory.

## 20. Security & privacy requirements
- Authorization on **every** route by role + workflow membership; deny by default; unit-test the matrix in §12.2 (including that a Client Viewer `PUT` returns 403 and a Client Editor cannot read `internalNotes`).
- Tokens: ≥128-bit random, **hash at rest**, constant-time compare, never logged, `Referrer-Policy: no-referrer`, `noindex`.
- Output encoding: node labels/notes are user content rendered in React and (for exports) in PDF/SVG — escape; strip HTML in all text fields (existing `sanitizeText` is regex-based; prefer a real sanitizer or store plain text only).
- Rate-limit invite-open, passcode attempts, comment and feedback endpoints durably; add basic abuse limits (payload size, node count per workflow).
- AI: never send client-visible-only data back to Claude beyond what the user supplied; log prompts/responses minimally; **upgrade the generation model id** (`claude-sonnet-4-20250514` is old — use the current default model in the host's AI configuration, and keep prompt behavior regression-tested).
- DB TLS: replace `rejectUnauthorized:false` with a proper CA bundle (F19).
- PII: reviewer/member names and emails are personal data — minimize, allow deletion on request, don't expose other members' details to clients.

---

# PART C — EXECUTION PLAN FOR OPUS 5.5

## 21. Operating instructions
- **Inspect before modifying.** Phase 0 is read-only. Identify the host project's framework, router, auth, DB/ORM, design system, email/queue infra, deployment target, test setup, and conventions; reuse them. Don't introduce a parallel architecture.
- **Give the whole task a finish line** (see §24) and keep going when the next step is clear, safe and inside scope; don't stop to announce progress or to ask preference questions.
- Persist long-run state in `TASKS.md` (scoped work, done, follow-ups, blockers) so context compaction can't lose it.
- Use subagents only for separable work (e.g. layout-linter fixtures, exporter, MCP tools); give each bounded scope and require evidence; **verify important claims yourself** — never accept a confident subagent statement as verification.
- Consult these skills **if installed in the host** at the stated moments; otherwise rely on this document: `ux-plan` (Phase 0/2 IA), `ux-design` (every screen/pattern/copy decision), `ux-audit` (end of each phase), `nextjs-vercel-performance-optimizer` (Phase 5), `opus-55-prompt-architect` (for the system prompt/skill text), and the Lucid skill (Phase 3/4 content source). Jolo can drop the `.skill` files into the host project; unzip them if needed.
- Check the worktree before commits; preserve unrelated work; keep diffs scoped; match existing code style; run build/typecheck before any deploy.

## 22. Autonomy boundaries & stop conditions
**Proceed autonomously:** reading, porting code, writing pure functions + tests, UI work behind a feature flag, local dev runs, additive code.
**Stop and ask Jolo (one question, with a recommendation) before:** applying any DB migration to a shared/production database; adding a dependency (propose with reason + size; likely candidates: a test runner, Playwright, an SVG→PNG/render-preview approach, a durable rate-limit store; email is out of scope per D6); changing public URLs/slugs/tokens that already exist; changing the auth model or the host's existing roles; sending any real email; deploying or merging to a production branch; deleting data; anything affecting live financial/production systems (none expected).
**Report-and-wait gates:** (1) after Phase 0 deliver Jolo's required **scoping summary** (restated ask, ambiguities & assumptions, implementation plan with files/why/schema-auth-URL-API-money-data flags, recommended order, confidence + reason, risks with mitigation, effort & blast radius) and wait for go-ahead; (2) before applying the Phase 2 migration; (3) before the first production deploy. If reality diverges from the approved plan, stop and report before improvising.
**Never** treat approval of code changes as approval to change production; prepare and validate migrations autonomously but **stop before applying them to production**.

## 23. Phases (each ends with a runnable, verified state)
**Phase 0 — Discovery (read-only).** Map the host; confirm module placement and route namespace (suggested `/workflows` for staff, `/w/<token>` for clients); produce the scoping summary; list dependency/migration requests. *Output:* plan + risk list. *Gate:* Jolo go-ahead.

**Phase 1 — Faithful port behind a flag.** Port the §3.1 items; consolidate duplicated normalizers (§3.3); adapt data layer; keep behavior identical. Add **Vitest** unit tests for `computeStepNumbers`, `getLayoutedElements`, `validateWorkflow`, edge-routing, `toMermaid`, normalizers using fixtures lifted from `prisma/workflow-template-data.ts`. *Done:* editor loads/saves/versions/shares/exports in the host; tests green; parity checklist ticked (Appendix D).

**Phase 2 — Access, sharing, concurrency.** Implement §12–§13: schema (after approval), authorization layer, **three links + named invites (copy-link only)**, client viewer (server-rendered DTO), approvals bound to versions, comments, audit log, in-app inbox, revision-checked ops saves + presence + conflict dialog, sanitization. **Phase 2b:** Suggesting mode (§12.6b) on the same ops pipeline. *Done:* permission-matrix test suite green; **editor-save-never-drops-internal-nodes** test green; Jolo can create a View, Comment and Edit link and a named invite, copy each, preview as each level, and a client can open a link on a phone with no account.

**Phase 3 — Process Map style + layout v2 + exports.** Implement §14–§16: new node kinds/fields, fill/tag/icon rendering, decimal numbering, generated legend & title block, spine layout, geometry linter, shared renderer, new PDF/PNG/SVG exports. *Done:* golden-fixture diagrams (≥3 real Jolo flows) render with zero linter errors; exports meet §14.3; Jolo signs off on screenshots against his Lucid originals.

**Phase 4 — MCP v2, guardrails, skill.** Implement §17–§18: new/changed tools, flow-table gate, gap check, `render_preview`, replacement skill + reference files. *Done:* an end-to-end Claude run (transcript → approved table → built diagram → lint clean → shared) works through the MCP with no Lucid involved.

**Phase 5 — UX polish & performance.** §19: toolbar regrouping, outline, Find, save-state UX, mobile viewer, perf pass with before/after numbers. *Done:* `ux-audit` re-run shows F1–F21 resolved or consciously deferred; performance targets recorded.

## 24. Definition of done (checkable)
1. A Super Admin can create (manually, from template, via AI, via MCP), edit, validate, publish, invite, and revoke.
2. A Viewer or Commenter opens a View/Comment link or personal link **with no account**, on desktop and phone, sees only client-safe content, can search/outline, (Commenter) comment, and export a client-safe PDF.
3. An Editor can edit allowed fields directly **or** in Suggesting mode; Jolo can accept/reject suggestions; comments and approvals work; two people editing never silently overwrite each other; internal content is never exposed or deleted.
4. Approvals are tied to versions; edits after approval are flagged; Jolo can see a diff.
5. Process Map diagrams reproduce the Lucid system (Appendix A/B), pass `lint_layout`, and export as legible vector PDFs ≥ the §14.3 bar.
6. MCP v2 + replacement skill complete the table → approve → build → verify loop; every mutating tool is revision-aware and audited.
7. Unit, integration (permissions), and e2e (create links → view → comment → suggest → accept; approve; editor conflict) tests pass in CI; build and typecheck are clean.
8. No unapproved migration, dependency, or deploy occurred; the final report lists every skipped check.

## 25. Validation plan
- **Unit (Vitest):** numbering (letters + decimal, golden), layout (spine rules), linter (one failing fixture per rule), validation findings, normalizers, sanitization DTOs, permission matrix (table-driven), token hashing/expiry/revocation.
- **Integration:** API authorization per role per route; revision conflict (409) path; hidden-content merge; version binding of approvals; export snapshot tests (PDF text extraction, page size, byte size).
- **E2E (Playwright, if approved):** staff edit → publish; invite viewer → open on mobile viewport → outline → comment → approve; editor edits while Jolo edits → conflict dialog; revoked link page; client-safe export contains no internal strings (grep the PDF text for planted `INTERNAL-…` markers).
- **Visual evidence:** screenshots of each diagram style and each role's view (desktop + 390 px mobile), before/after of the same workflow in Classic vs Process Map; do not claim visual correctness without them.
- **Perf:** React Profiler (drag 150-node canvas), bundle analyzer (viewer chunk excludes editor), Lighthouse on the viewer.
- **Self-audit checklist** (the Lucid skill's, automated via §16.3 and §18.3) executed through the linters, with anything not automatable kept as a manual checklist in the PR.

## 26. Final report format (to Jolo)
Lead with the outcome. Then: changed files, database impact, tests/checks run, skipped checks (with reasons), known limitations, remaining decisions, and whether the approved plan was followed. After any deployed or user-facing work add simple verification steps: the exact URL/page, exact buttons, sample values, what success looks like, and what indicates a problem (and, per Jolo's standing rule, a **testing checklist** immediately after any production deployment).

---

# APPENDICES

## Appendix A — Action Type ⇄ bracket tag ⇄ icon (strict 1:1) [S]
Lucid used Azure-library icons; the module should use `lucide-react` (proposed mapping — **render and eyeball before committing**).
| Action Type | Tag | Use for | Lucid icon | Proposed lucide icon |
|---|---|---|---|---|
| Candidate | `[CANDIDATE]` | Actor is the candidate (answering/submitting/choosing). Takes precedence over Message/System even if AI facilitates | Users | `Users` |
| Move | `[MOVE]` | Any folder move, including automatic move to Rejected. Tag by what the step does, not who triggers it. **Never `[SYSTEM]`** | Folder Blank | `FolderInput` |
| Call | `[CALL]` | Phone call or retry | Speech Services | `Phone` |
| AI Interview | `[AI]` | An AI-**conducted interview** only (chatbot prescreening = `[SYSTEM]`) | Bot Services | `Bot` |
| Message | `[MESSAGE]` | Email or SMS send **to a candidate/external person** (never `[MSG]`) | Azure Communication Services | `Mail` / `MessageSquare` |
| Alert | `[ALERT]` | A system notification **to an internal person** (handler, lead, recruiter, super admin) — e.g. an automated reminder email to the assigned handler. *(New tag, Jolo decision 2026-10-03; introduced in MyPal v3.)* | Azure Communication Services (shares the Message glyph, same as Rejection Reason shares Tag) | `Mail` / `MessageSquare` (same glyph as Message) |
| System | `[SYSTEM]` | Any other automated step (never a folder move) | Gear | `Cog` |
| Create/Add Data | `[Add Data]` | Writing an attribute, assigning label/owner/recruiter ("Assign User"), creating a profile, integration writing data into Talkpush (never `[WRITE]`) | Tag | `Tag` |
| Read Data | `[READ DATA]` | Reading an existing attribute, internal only | Search | `Search` |
| Integration (Get) | `[GET DATA]` | Pull from external system into Talkpush | Download | `Download` |
| Integration (Send) | `[SEND DATA]` | Push from Talkpush to external system | Input Output | `ArrowLeftRight` |
| Rejection Reason | `[REJECTION REASON]` | Reason logged on rejection (red dashed note; shares Tag icon) | Tag | `Tag` |
| Export | `[EXPORT]` | A data export | Table | `Table` |
| Share Profile | `[SHARE PROFILE]` | Sharing a candidate profile | Groups | `Share2` |
| Wait | `[WAIT]` | A pure delay drawn as its own step; a reminder cadence bundled in one box stays `[MESSAGE]`/`[MOVE]` | Scheduler | `Clock` |
**`[ALERT]` rule:** choose by the *recipient*: candidate/reporter/external → `[MESSAGE]`; internal staff → `[ALERT]`. Both share the message glyph, so the badge looks the same; the tag text tells them apart. Add `Alert` to the Action Type enum, flow table, linter and replacement skill (strict 1:1 preserved).
Rules: a **white (person acts)** box additionally carries the **people icon** (`Users`). Decisions, terminators, other notes, jump markers: no badge. Every tag has an Action Type and vice-versa — never introduce one without the other. `[LABEL]` is retired (folded into `[Add Data]`).

## Appendix B — Process Map style tokens [S]
```
fill.system   #C8E6C9   stroke #333333 solid
fill.person   #FFFFFF   stroke #333333 solid
fill.decision #BBDEFB   stroke #333333 solid
fill.note     #FFF9C4   stroke #666666 dashed
fill.jump     #E1BEE7   stroke #6A1B9A solid
end.success   #2E7D32 (white bold text)   end.failure #EF9A9A   end.neutral #ECEFF1   end.soft #C8E6C9
note.orange   #FFE0B2 (orange dashed)   note.rejection #FFCDD2 (red dashed)   note.outofscope #ECEFF1 (gray dashed)
table.header  #ECEFF1   table.highlight #FFE0B2   container tab: gray label, light-gray rounded border
(measured from Jolo's MyPal v3 and Teleperformance v5.1 PDFs — see §15.8)
rejection-reason note: red dashed · info note: yellow dashed · needs-input note: orange dashed
title: 16pt bold; meta: 9pt (vN · date · author); badge: 40px tall, 6px above the box's top edge, left-aligned to the box
label font in shapes: body 6–11pt scale from the Lucid builds — keep one size per shape class
```

## Appendix C — Rules to put in the new MCP `instructions` / skill (condensed) [S]
1. Always show the **proposed flow table** and get explicit approval before touching the diagram. No fast path.
2. Always keep a diagram to **one page**.
3. Always run the **TA/BPO gap check** and flag gaps as questions (🔴/🟡/🟢); never silently fill or omit.
4. Ask at intake: **internal or client-facing?**
5. **Never guess** a technical or business detail: route to Clara-ai/Nairi (what is configured in the CRM), Replit (Replit-built products), named engineering, or the client (business rules, SLAs, rejection reasons). Use an orange "To confirm with [Client]" note instead of inventing routing.
6. Fill follows the **actor**; role in brackets on every white box; people icon on every white box.
7. Branch numbering on by default; renumber on every spine edit; never number terminators.
8. After any change, **render and look** (and run `lint_layout`); never trust a success response.
9. Snapshot before bulk AI edits; after a human has edited, diff first and ask which is the source of truth — never rebuild over manual edits.
10. Don't narrate every tool call; report at checkpoints (summary approved, validation passed, created/edited, handoff). Use plain language with the SE.
11. Naming convention: `[Client] [Process] - [Description] (vN-change-summary)`; version change updates both title block and workflow name.
12. Handoff to CRM configuration planning must include: confirmed workflow id/page/title, tenant subdomain, and every orange "To confirm" note and every "Pending from [person]" rejection reason (so those rows are marked blocked, not guessed).
13. If a convention/quirk isn't covered, **extend the reference file and add a version-history line** instead of working around it.

## Appendix D — Parity checklist for Phase 1 (must behave identically before upgrading)
Create/rename/delete workflow · template create & save-as-template · AI Generate (+ measured re-layout) · all 13 node types render and edit · drag/drop + click-add + ＋ quick-add + suggestion popup · connect/reconnect/dangling endpoints · edge types/markers/colors/semantics/labels · draggable waypoints + reset · lasso, copy/paste/duplicate, delete, undo/redo · swimlane/frame/annotation · table node editing · layers/lock/minimap · pages (add/rename/delete/switch) · autosave + unmount flush · version snapshots (status/manual/restore) + preview + restore · SE Brief (artifacts CRUD, validate, summary) · share (token, pin/unpin, revoke) · public view + sign-off · PDF (full + selection) · Mermaid · all 29 MCP tools + OAuth flow · numbering outputs identical on every seed template (snapshot test).

## Appendix E — Reference examples
**Minimal spec for `create_workflow_from_spec` [V]:**
```json
{
  "clientName": "Acme BPO", "workflowName": "Voice screening", "layoutDirection": "LR",
  "nodes": [
    {"tempId":"n1","type":"source","label":"Facebook Messenger","actor":"source"},
    {"tempId":"n2","type":"stage","label":"Prescreening chatbot","actor":"automated","data":{"talkpushAction":"send_question_set"}},
    {"tempId":"n3","type":"decision","label":"Passed prescreening?","actor":"automated"},
    {"tempId":"n4","type":"manual_action","label":"Recruiter interview","actor":"manual","actorLabel":"Recruiter","data":{"ownerRole":"Recruiter"}},
    {"tempId":"n5","type":"communication","label":"Rejection SMS","actor":"automated","data":{"channel":"sms"}}
  ],
  "edges": [
    {"sourceTempId":"n1","targetTempId":"n2"},
    {"sourceTempId":"n2","targetTempId":"n3"},
    {"sourceTempId":"n3","targetTempId":"n4","label":"Pass","isHappyPath":true,"isPrimary":true},
    {"sourceTempId":"n3","targetTempId":"n5","label":"Fail","pathSemantic":"failure"}
  ],
  "artifacts": [{"kind":"open_question","title":"Cooling period?","detail":"Confirm 30 vs 90 days with client."}]
}
```
**Target flow-table row (Process Map)** [S]:
| Step | Actor | Action | Action Type | Branch / Condition |
|---|---|---|---|---|
| ④ | Talkpush | Moves to Interview Scheduling | Move | — |
| ⑤ | Candidate | Self-schedules interview | *(decision, no type)* | — |
| 5.1 | Talkpush | Reminder at 48h with fresh link; auto-moves to Rejected | Move | No response |

## Appendix F — Remaining questions for Jolo (D1–D4, D6, D8–D11 closed; recommendations in bold)
1. **Commenting for Viewers:** **off** (Viewer = look only; Commenter = look + comment).
2. **Can Editors in Direct mode accept other people's suggestions?** **No (Jolo only).**
3. **Where the module lives in the host's navigation:** **match the host's pattern** (the agent discovers it in Phase 0).
4. **Client-facing plain-language terms** (e.g. "autoflow" → "automated step"): **the agent asks per term; never decides silently.**
5. **Retention for guest names/comments/audit events:** **24 months, deletable on request.**
(These have safe defaults; the agent proceeds with the bold option unless Jolo says otherwise.)
