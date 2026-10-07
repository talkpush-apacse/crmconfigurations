# Product

<!-- impeccable:product-schema 1 -->

> Updated 2026-10-05 from an Impeccable init interview with Jolo. Confirmed by Jolo: three live modules, how process maps are shared, and who uses the staff screens. Facts marked (inferred) are still unconfirmed.

## Platform

web

## Users
- **Jolo Yu, Solutions Engineer.** The main staff user today. Others may join later, so design for one power user first. Works at a desk, in long sessions, switching between clients.
- **Other Talkpush staff** (Solutions Engineers, implementation and project leads) are possible future users (inferred). They are not a design driver yet.
- **Client project leads and contacts.** They fill in their part of the CRM configuration checklist. In the tracker they see their own project's status and update the items they own. They also review process maps shared with them.
- **Client executives and sponsors.** They open a client-safe summary, often on a phone, to answer one question: where are we now and what is still open.
- **Vendors** appear as owners of items. They do not log in (inferred).

## Product Purpose
**Talkpush Implementation Hub** is the name of the whole portal. Three modules behind one staff login, all live.
1. **CRM Config Checklist:** collects and tracks the configuration data Talkpush needs from a client to set up their CRM, then exports it and generates configurator steps.
2. **Project Tracker:** tracks client implementation projects. Accounts, projects, phases, open items with status, owner, dates and dependencies, remarks, and success metrics with a baseline. Views: Kanban board, Gantt timeline, list, and an Exec Summary. Read-only client links.
3. **Workflow Builder:** Solutions Engineers turn a client's recruitment process into a client-ready process map (steps, branches, actor lanes, stages, notes) in an editor, and share it with the client through a copy-link. Maps are mostly built and edited by talking to Claude through the MCP connector.

Staff status and map edits can also be made through MCP from Claude (a combined connector plus per-module endpoints).

Success: an executive can answer "where are we now and what open items are needed" in a glance. A client can read their process map without a walkthrough. Staff spend less time chasing status and redrawing diagrams.

## Positioning
Built for Talkpush implementation work specifically. It knows the phases of a Talkpush rollout, separates "waiting on client" from "blocked", links a project to the client's own CRM config progress, and draws recruitment process maps that follow Talkpush's own conventions. Everything can be updated by talking to Claude through MCP.

## Operating Context
- Staff work in the admin area behind a login (email and password or Google, restricted to existing admin users). Login lands on the Companies gallery: each company shows its checklists, workflows and project trackers (several of each), and the three modules are also reachable across all companies from the header.
- Clients reach the product through secret links, not passwords (decision locked in planning).
- Process maps are either internal or client-facing. A client-facing map must never show staff-only content.
- The Workflow Builder sends no emails. Sharing is copy-link only.
- Hosted on Vercel, Next.js 16 App Router, Prisma 7, Supabase Postgres, Tailwind 4, shadcn/Radix, Lucide icons. Live at crm.se-talkpush.com.
- Executive output may be viewed on a phone or printed, so client-facing views must work at 375px and in print.

## Capabilities and Constraints
- Existing checklist features, routes and MCP endpoints must not change shape without approval.
- Tracker and Workflow Builder are additive: their own `Tracker*` and `Workflow*` tables in the same database, with row-level security.
- Items, remarks and map content carry visibility (client_visible or internal). Client-safe views must never expose internal data or other clients' data. When unsure, it is internal.
- No new dependencies without approval. Approved so far for the Workflow Builder: `@xyflow/react` and `@dagrejs/dagre`. Kanban uses the installed `@dnd-kit`. The gantt and charts are built by hand. PDF export of maps is a stub until a PDF library is approved.
- No database migration is applied without approval. Never deploy without asking.
- Process map conventions (binding): concise boxes, details in dashed notes attached to the step, text centred in every shape, every path out of a decision labelled, "Channel · When" inside automated message boxes, unknown values as an orange to-confirm note and never guessed. Actor lanes are derived from the actors in each diagram, never a hard-coded list. The classic single-row layout stays available for simple maps.
- Terminology: Account (a client company), Project, Phase, Open item, Owner, Dependency, Success metric, Baseline, Health (On track, At risk, Off track), Process map, Step, Lane, Stage.
- Not decided: project templates, notifications, auto-pulling metrics from Talkpush analytics, PDF export of maps.

## Brand Commitments
- The Talkpush Design System in `Talkpush Design System/` is binding. Staff screens follow Talkpush Sign (context C). Client-facing views follow the executive report system (context A). The checklist a client fills in (editor and client view) follows the client form face described in `DESIGN.md`.
- Voice: finding-first headlines with a verb, sentence case, honest about bad news, no em dashes, no hype, no jargon.
- The real Talkpush logo only. The official horizontal lockup has not been supplied yet.

## Evidence on Hand
- The Talkpush brand guidelines and design tokens in `Talkpush Design System/`.
- The existing app UI and its UX review in `docs/ux-review/`.
- The Workflow Builder spec and task list in `docs/workflow-builder/`.
- No real client project data, testimonials or metrics have been supplied. Do not fabricate any. Demo data must be clearly fake.

## Product Principles
- Say where the project stands first, then the evidence. The conclusion leads.
- Make it obvious whose turn it is: Talkpush, the client, or a vendor.
- Never hide bad news. A late or blocked item is stated plainly, with the number of days.
- One source of truth per fact. The same status, owner and date appear identically on the board, timeline, list and summary.
- Clients see only what they should. When unsure, an item is internal.
- A process map should be readable by the client's own recruiter without explanation. Short boxes, detail in notes, no guessing.

## Accessibility & Inclusion
- Keyboard access and visible focus on every control, including a keyboard alternative to drag and drop.
- Status and health never rely on color alone.
- Text contrast meets WCAG AA. Touch targets are at least 44px on mobile.
- English for all client-facing and executive content.
