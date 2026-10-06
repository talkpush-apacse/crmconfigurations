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
   **Keep the table's Action column short** (a few words: "Chatbot prescreening", "Sends booking link"). Anything extra, such as the list of questions or opening days, goes in a Notes line under the table and becomes a dashed note on the map, not text inside the box (the one exception is Channel · When, below). Give every path out of a decision a label, the main path included ("Yes", "Pass").
   **Channel and cadence (an exception to "short boxes"):** every **automated** message, call or alert (tags `[MESSAGE]`, `[ALERT]`, `[CALL]`, `[AI]`) gets a `Channel · When` value, and the flow table you draft has a **Channel · When** column for those rows (for example "Email · 1 hour after", "SMS · 2 days after", "Email + SMS · immediately"). Channel and timing are what the client actually approves, so they are the one detail that goes inside the box. If the SE or client has not said, ask; if it stays unknown, add an orange "To confirm" note. Never fill it in from habit. Do not move a candidate to Rejected without showing the message they receive (or saying plainly that none is sent).
   **Lanes or the classic single row:** the tool chooses from your table. Lanes (stage bands, one row per actor, outside systems as blue lanes) are used automatically when the process has **3 or more different actors**, **any outside system** (assessment platform, HRIS, a vendor) or **stages**; otherwise the classic single row. Tell the SE which you chose and why, and offer the other (`layout: "lanes"` or `"spine"` when building, `set_diagram_layout` on an existing map). For lanes the table you draft gets **Stage** and **Lane** columns: Lane is who does the step, in the client's words, spelled the same on every row (a role, an employee, a vendor, an outside system: never a fixed list); Stage is a short plain phrase written once on the first row of each stage. Steps the system does live in the lane **Talkpush automation** by default ("Talkpush", "System" and "Autoflow" all mean it). Outside systems are named in `externalLanes`. A step inside an outside system's lane is what that system does ("Scores the assessment"); the Talkpush side is a Send Data or Get Data step that names the system. If you cannot tell who does a step, ask; never invent a lane.
3. **Wait for an explicit yes.** There is no fast path. Then call `create_workflow_from_flow_table` with `approved: true`.
4. **Run the gap check** (`run_gap_check`). Blockers: list them and stop. Assumptions: "Assumed X because Y. If incorrect, Z changes." Nice to know: mention briefly. These are for the SE, never text inside a diagram shape. See `references/gap-check.md`.
5. **Check your work by looking at it.** Call `lint_layout` and `render_preview` (audience `client` for client-facing work) after every change. A success message proves nothing. Fix every high finding before saying it is done.
6. **Never rebuild over a human's edits.** Before changing an existing workflow: `get_workflow` (note the revision), `diff_versions` against the last version you built or the client approved, and ask which is the source of truth. Pass `baseRevision` on changes. Prefer `propose_changes`, which creates a suggestion the owner accepts. Big changes take a snapshot automatically.
7. **Share only when asked.** `create_link`, `invite_person`, `publish_version`, `accept_suggestion`, `reject_suggestion` and `share_workflow` are for explicit requests only. Nothing is emailed: give the SE the address to copy.
   **Deleting a whole workflow** (`delete_workflow`) is the same kind of explicit-request tool: only when the SE names the map and asks, only for a map that was never shared (still a draft: no links, invited people, published version or comments), and only after confirming its exact name in chat. It cannot be undone. A shared map is deleted by the SE from the workflows list. Never delete as tidy-up.
8. **Hand off** to CRM configuration planning with: the workflow id and page, the title, the tenant subdomain, **every orange "To confirm" note**, and every "Pending from <person>" rejection reason, so those rows are marked blocked instead of guessed.

## Boxes are short, details live in notes (Jolo's standing preference)

- **Main-path and branch boxes stay concise**: the role or tag, a short name, and for an automated message, call or alert one `Channel · When` line (see below). No lists, no opening hours, no explanations.
- **Extra information goes in a note shape attached to that step** (dashed outline): `add_node` with `type: note`, `attachTo` the step. Yellow (`info`) for general detail such as the four prescreening questions; orange (`needs_input`, titled "To confirm with <client name>") for anything unknown. Never put detail in a box's `notes` field to save a shape. The `timing` field is for the `When` of an automated step (and the turnaround of a manual one), not for explanations.
- **One note per kind per step.** If a step needs both an explanation and a to-confirm, fold them into the single orange note; several notes on one step crowd the map.
- **Plain words, for a reader who has never heard of Talkpush.** Name a step by what happens to the candidate or the work, not by system jargon: "Sends booking link", not "Triggers autoflow". The first time the automatic steps appear, say in an info note that Talkpush is the recruiting platform doing them.
- **Move steps always say Folder/Stage, with the folder name in bold.** Write "Moves to **Expected to Show Up** Folder/Stage" (wrap the folder name in double asterisks), including the automatic move to Rejected ("Moves to **Rejected** Folder/Stage"). The tool also adds this for a plain "Moves to X" Move step, and `validate_workflow` flags a Move step that does not follow it (`move_wording`).
- **End shapes say why.** "Rejected: did not pass prescreening", "Hired: offer accepted", not just "Rejected" or "Hired". The key explains the colours (green, pink, grey) only for the end states the diagram uses.
- **Text is centred in every shape.** The tool draws it that way: do not try to align text with spaces or line breaks.
- **A timing in a note is not seen by the gap check** unless it is an info note that states a time. An orange note keeps the turnaround assumption on the list, which is correct while the time is unknown.

## One page, one title, one name

- One page per diagram unless the SE asks otherwise.
- Name: `[Client] [Process] - [Description] (vN-change-summary)`. A version change updates the title block and the workflow name together.
- The title block shows `vN · date · author` only. Never explain conventions inside it.

## Living document

If a convention or quirk is not covered here, say so and ask. Then extend the matching file in `references/` and add a line to the version history below instead of working around it.

## Version history

| Date | Change |
|---|---|
| 2026-10-04 | One default lane name for automated steps: "Talkpush automation". |
| 2026-10-04 | Lanes and stages for the connector: when to use them (3+ actors, an outside system, or stages), the Lane and Stage table columns, outside systems as blue lanes, `layout`, `externalLanes`, `set_diagram_layout`. |
| 2026-10-04 | Key now explains end-state colours and the numbering (with an example); plain-words and "end shapes say why" rules. The key still lists no tags. |
| 2026-10-04 | Added channel and cadence: every automated message, call or alert carries `Channel · When` in the box and a column in the flow table. |
| 2026-10-04 | Added `delete_workflow` rule (never-shared drafts only, on explicit request, name confirmed first). |
| 2026-10-04 | Added "Boxes are short, details live in notes", centred text, label every path, several entry channels, revision on every reply, and the numbering effect of marking a main line. Matches Workflow Builder PR #33. |
| 2026-10-04 | First version for the Workflow Builder: adapted from the Lucid skill. `[ALERT]` is the 15th tag; the diagram key lists colours and shapes only (no tag icons); a table appears only after the flow table is approved. |
