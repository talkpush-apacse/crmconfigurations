# Visual system (Process Map style)

Measured from the MyPal v3 and Teleperformance v5.1 reference diagrams. The tool draws all of this itself; you choose the meaning, never the pixels.

## Colour follows who acts, never the tag

| Meaning | Shape | Fill |
|---|---|---|
| The system does it, no person needed | rectangle | green `#C8E6C9` |
| A person acts (role in brackets, people icon) | rectangle | white |
| Decision | diamond | blue `#BBDEFB` |
| True start (entry channel) | rounded oblong | white |
| End: success / failure / neutral hand-off / soft success | rounded oblong | dark green (white text) / pink `#EF9A9A` / grey `#ECEFF1` / light green |
| Jump to another step | small circle | purple `#E1BEE7` |
| Note | dashed rectangle | yellow `#FFF9C4` |
| To confirm with the client | dashed rectangle | orange `#FFE0B2` |
| Rejection reason | dashed rectangle | pink `#FFCDD2` |
| Out of scope | dashed rectangle | grey |

A person who acts and then something happens automatically is **one white box**: add "The system then ..." to the text. Never split it into two boxes and never renumber for it. If it is unclear who performs a step, ask.

## Short boxes, centred text, details in notes

- Every shape's text is **centred**, horizontally and vertically, on screen and in every download.
- A box says what happens in a few words. Lists, opening days and explanations go in a **note** (dashed outline) attached to the step: yellow for information, orange for "To confirm with <client name>". Several notes on one step stack above (main path) or beside (branch) it, so keep it to one or two.
- Several ways in (a Facebook ad and a careers page) are **separate entry shapes**, stacked in one column centred on the main row, each leading to the first step. Use `entryLabels` when building from a table.

## Channel and cadence on automated steps

Every automated message, call or alert (tags `[MESSAGE]`, `[ALERT]`, `[CALL]`, `[AI]`) carries one short italic last line, **Channel · When**. It is the one detail, besides role/tag and a few-word name, that belongs inside the box.

| Example | Reads as |
|---|---|
| Sends rejection notice | `Email · 1 hour after` |
| Reminder to book | `SMS · 2 days after` |
| Confirms the interview | `Email + SMS · immediately` |
| Calls to confirm | `Voice call · the day before the interview` |

- Channels: Email, SMS, WhatsApp, Messenger, Voice call, Web, LINE, or the client's own word (shown as typed). Several: `Email + SMS`.
- When: `immediately`, `N hours/days after <event>`, `N hours/days before <event>`. Anchor it to what triggers it.
- **A cadence ladder** (reminders at 1H, 3H, 24H, 48H, 72H) is summarised in the box ("SMS · 6 reminders over 3 days") and written out in a note attached to the step. Use a **Wait** step only where the flow really pauses and then branches (no reply, then Rejected).
- Unknown channel or timing: orange "To confirm" note. Never guess. The gap check lists every automated message, call or alert that is missing either.
- Show the message a rejected candidate receives, or say plainly that none is sent.

## Role and tag

Every white box starts with the acting role in capitals and brackets, in the client's words: `[REPORTER]`, `[HANDLER]`, `[HANDLER, then LEAD]`, `[RECRUITER]`, `[HIRING MANAGER]`, `[CANDIDATE]`. Never `[PERSON]` or `[MANUAL]`. Every white box carries the people icon.

Green boxes carry the tag of their Action Type. One tag per Action Type, one Action Type per tag:

`[CANDIDATE]` `[MOVE]` `[CALL]` `[AI]` `[MESSAGE]` `[ALERT]` `[SYSTEM]` `[Add Data]` `[READ DATA]` `[GET DATA]` `[SEND DATA]` `[REJECTION REASON]` `[EXPORT]` `[SHARE PROFILE]` `[WAIT]`

Decisions and genuinely manual steps have no tag.

- **Move**: any folder move, including an automatic move to Rejected. Tag by what the step does, not who triggers it. Never `[SYSTEM]`.
- **AI**: only an AI-conducted interview. A chatbot prescreening is `[SYSTEM]`.
- **Message vs Alert**: choose by the recipient. Candidate, reporter or outside person: `[MESSAGE]`. Internal person (handler, lead, recruiter, super admin): `[ALERT]`.
- **Integration steps**: classify by which side of the boundary the step is on (`[GET DATA]` pulls into Talkpush, `[SEND DATA]` pushes out). If both are needed, two steps.

## Numbering

See `numbering.md`.

## Diagram key

Generated for you. Rows: green "System does it, no person needed", white "A person acts (role in brackets)", blue "Decision", then only the kinds this diagram uses (yellow Note, orange "To confirm with <Client>", pink Rejection reason, grey Out of scope, purple Jump). **The key lists colours and shapes only: no tags, no tag icons.**

## Layout (the tool does this)

Main path on one straight row, left to right; branches drop below their decision with elbow connectors, centred under it; the entry channel on the same row as the main path; notes beside a step, never in a connector's path; one exit point per fork; faraway rejoins become jump markers. `lint_layout` checks all of it.
