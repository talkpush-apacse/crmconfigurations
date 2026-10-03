# Product

<!-- impeccable:product-schema 1 -->

> Draft written from the repository and the planning session, not from an Impeccable interview. Facts marked (inferred) need Jolo's confirmation.

## Platform

web

## Users
- **Talkpush staff** (Solutions Engineers, implementation and project leads). They configure Talkpush CRM for enterprise clients and run implementation projects across many accounts at once. They work at a desk, in long sessions, switching between clients. Primary user today is Jolo Yu (inferred).
- **Client project leads and contacts.** They fill in their part of the CRM configuration checklist and, in the tracker, see the status of their own project and update the items they own.
- **Client executives and sponsors.** They open a client-safe summary, often on a phone, to answer one question: where are we now and what is still open.
- **Vendors** appear as owners of items. They do not log in (inferred).

## Product Purpose
**Talkpush Implementation Hub** is the name of the whole portal. Two modules behind one login.
1. **CRM Config Checklist** (exists today): collects and tracks the configuration data Talkpush needs from a client to set up their CRM, then exports it and generates configurator steps.
2. **Project Tracker** (being built): tracks client implementation projects. Accounts, projects, phases, open items with status, owner, dates and dependencies, remarks, and success metrics with a baseline. Views: Kanban board, Gantt timeline, list, and an Exec Summary. Status can be updated through MCP from Claude.

Success: an executive can answer "where are we now and what open items are needed" in a glance, and staff spend less time chasing status.

## Positioning
A tracker built for Talkpush implementation work specifically: it knows the phases of a Talkpush rollout, separates "waiting on client" from "blocked", links to the client's own CRM config progress, and can be updated by talking to Claude through MCP.

## Operating Context
- Staff work in the admin area behind a login (email and password or Google, restricted to existing admin users).
- Clients reach the product through secret links, not passwords (decision locked in planning).
- Hosted on Vercel, Next.js 16 App Router, Prisma 7, Supabase Postgres, Tailwind 4, shadcn/Radix, Lucide icons.
- Executive output may be viewed on a phone or printed, so the client-facing summary must work at 375px and in print.

## Capabilities and Constraints
- Existing checklist features, routes and the existing MCP endpoint must not change.
- The tracker is additive: new `Tracker*` tables in the same database, a separate MCP endpoint and key.
- Items and remarks carry visibility (client_visible or internal). The client-safe view must never expose internal data or other clients' data.
- No new dependencies without approval. Kanban uses the installed `@dnd-kit`. The gantt and charts are built by hand.
- Terminology: Account (a client company), Project, Phase, Open item, Owner, Dependency, Success metric, Baseline, Health (On track, At risk, Off track).
- Not decided: project templates, notifications, auto-pulling metrics from Talkpush analytics.

## Brand Commitments
- The Talkpush Design System in `Talkpush Design System/` is binding. Staff screens follow Talkpush Sign (context C). Client-facing views follow the executive report system (context A).
- Voice: finding-first headlines with a verb, sentence case, honest about bad news, no em dashes, no hype, no jargon.
- The real Talkpush logo only. The official horizontal lockup has not been supplied yet.

## Evidence on Hand
- The Talkpush brand guidelines and design tokens in `Talkpush Design System/`.
- The existing app UI and its UX review in `docs/ux-review/`.
- No real client project data, testimonials or metrics have been supplied. Do not fabricate any. Demo data must be clearly fake.

## Product Principles
- Say where the project stands first, then the evidence. The conclusion leads.
- Make it obvious whose turn it is: Talkpush, the client, or a vendor.
- Never hide bad news. A late or blocked item is stated plainly, with the number of days.
- One source of truth per fact. The same status, owner and date appear identically on the board, timeline, list and summary.
- Clients see only what they should. When unsure, an item is internal.

## Accessibility & Inclusion
- Keyboard access and visible focus on every control, including a keyboard alternative to drag and drop.
- Status and health never rely on color alone.
- Text contrast meets WCAG AA. Touch targets are at least 44px on mobile.
- English for all client-facing and executive content.
