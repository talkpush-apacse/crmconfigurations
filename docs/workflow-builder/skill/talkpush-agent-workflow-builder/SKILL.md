---
name: talkpush-agent-workflow-builder
description: Build, check and share client-ready hiring-process maps in the Talkpush Workflow Builder (the replacement for building diagrams in Lucid). Use whenever Jolo or another Solutions Engineer asks for a process map, workflow diagram, candidate journey or flow of a recruitment process, wants to turn call notes or a transcript into one, wants to change, check, review or share an existing one, or says "build this in the workflow builder". Covers the flow-table-first rule, the visual system (colours, tags, numbering), the TA/BPO gap check, client sanitization, the self-audit through lint_layout and render_preview, and the handoff to CRM configuration planning.
---

# Talkpush workflow builder skill

This is the working method for process maps, adapted from the Lucid skill. The tool does the drawing, layout, numbering, versioning and sharing; **you do the thinking and keep the rules**. Everything Lucid-specific (import files, assisted layout, text-in-shapes tricks) is gone: the Workflow Builder draws every diagram the same way, on screen and in every download.

Read `references/visual-system.md` before the first build in a session and `references/tool-map.md` when you need to know which tool to call.

## Who this is for, and the "never guess" rule

The user is a Solutions Engineer, not a developer. Talk in plain language. Never narrate tool calls; report at checkpoints: *summary approved, built, checked, shared*.

**Never guess a technical or business detail.** Route it instead:

| The question is about | Ask |
|---|---|
| What is configured in the CRM today | the CRM configuration owners (Clara-ai / Nairi) |
| A product built on Replit | the owner of that product |
| An engineering detail | the named engineer |
| Business rules, SLAs, rejection reasons, who does what | the client |

When something is unknown and routing is unclear, do not invent a path. Add an **orange "To confirm with <Client>" note** (a `note` step, `noteKind: needs_input`) and carry it into the handoff.

## The method

1. **Ask first: internal or client-facing?** Client-facing means sanitization applies (see `references/sanitization.md`).
2. **Draft the flow table in chat** (Step, Actor, Action, Action Type, Branch / Condition). `Actor` is one of Candidate, Talkpush, Recruiter, Referrer/Vendor; if the process needs another word (HANDLER, REPORTER) say so, do not invent a fifth silently. Candidate-actor steps are `[CANDIDATE]` even when AI facilitates. Do not assume something mentioned in passing is decoration: round-robin assignment looked like a note and was a real `[Add Data]` step.
3. **Wait for an explicit yes.** There is no fast path. Then call `create_workflow_from_flow_table` with `approved: true`.
4. **Run the gap check** (`run_gap_check`). Blockers: list them and stop. Assumptions: "Assumed X because Y. If incorrect, Z changes." Nice to know: mention briefly. These are for the SE, never text inside a diagram shape. See `references/gap-check.md`.
5. **Check your work by looking at it.** Call `lint_layout` and `render_preview` (audience `client` for client-facing work) after every change. A success message proves nothing. Fix every high finding before saying it is done.
6. **Never rebuild over a human's edits.** Before changing an existing workflow: `get_workflow` (note the revision), `diff_versions` against the last version you built or the client approved, and ask which is the source of truth. Pass `baseRevision` on changes. Prefer `propose_changes`, which creates a suggestion the owner accepts. Big changes take a snapshot automatically.
7. **Share only when asked.** `create_link`, `invite_person`, `publish_version`, `accept_suggestion`, `reject_suggestion` and `share_workflow` are for explicit requests only. Nothing is emailed: give the SE the address to copy.
8. **Hand off** to CRM configuration planning with: the workflow id and page, the title, the tenant subdomain, **every orange "To confirm" note**, and every "Pending from <person>" rejection reason, so those rows are marked blocked instead of guessed.

## One page, one title, one name

- One page per diagram unless the SE asks otherwise.
- Name: `[Client] [Process] - [Description] (vN-change-summary)`. A version change updates the title block and the workflow name together.
- The title block shows `vN · date · author` only. Never explain conventions inside it.

## Living document

If a convention or quirk is not covered here, say so and ask. Then extend the matching file in `references/` and add a line to the version history below instead of working around it.

## Version history

| Date | Change |
|---|---|
| 2026-10-04 | First version for the Workflow Builder: adapted from the Lucid skill. `[ALERT]` is the 15th tag; the diagram key lists colours and shapes only (no tag icons); a table appears only after the flow table is approved. |
