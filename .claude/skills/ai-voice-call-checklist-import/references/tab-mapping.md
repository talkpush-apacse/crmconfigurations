# Sheet-by-sheet mapping

The source workbook always has these sheets (names are stable; a few clients may add or omit one —
flag anything unexpected rather than silently skipping or force-fitting it):

`Global Agent Settings`, `Pre-Screening Questions`, `Agent 1 - Pre-Screening`, `Agent 2 - Chase`,
`Agent 3 - Reminder`, `Agent 4 - Reschedule`, `Call Handling`, `FAQ Content (OPTIONAL)`,
and a sign-off sheet whose title includes the client's actual name (e.g. `Inspiro Sign-off`) —
match this one by the suffix `Sign-off`, not by a literal client-name string.

Detect every section within a sheet by its header text or label (`"Main Script"`,
`"Scheduling Script"`, `"Question"`, `"Approved?"`, `"Settings"`, etc.) and by indentation (a script
line under a branch starts with leading spaces and often `[If Yes] ->` / `[If No] ->`), never by a
fixed row number — the exact row a section starts on shifts between files even when the sheet names
and header wording don't.

An "Approved?" column is always a 2-state dropdown in the source (`☐ Pending` / `☑ Approved`) — treat
it as a boolean. Don't assume a 3rd "Rejected" state exists unless a specific file actually shows one.
Some rows have no value there at all — genuinely blank, not even `☐ Pending` (this has shown up more
than once: Inspiro's own "Call status" setting, and a "Are you an AI or a human?" FAQ row in a later
test file). Treat a blank cell the same as unapproved (`false`) — it's still a real, if unremarkable,
instance of "don't invent data": there's no signal in the cell either way, so don't guess `true`.

## 1. Global Agent Settings → one custom tab, form-based (`fields`)

Two `table`-type fields, in this order:

- **"The 4 agents at a glance"** — plain text columns: `Agent`, `When it calls`, `What it's for`.
  No approval column here; the source doesn't have one for this table.
- **"Settings"** — typed columns: `Setting` (text), `Value` (text), `Notes` (textarea), `Approved?`
  (checkbox), `<Client> Comments` (textarea, named after the source's own header wording — it was
  literally "Inspiro Comments" in the first file; use the equivalent for the new client).

## 2. Pre-Screening Questions → the app's EXISTING standard tab, not a new custom tab

Use `add_prescreening_questions`. For each question:

- **Infer `questionType`** from the question's own wording, using this app's existing vocabulary:
  `Text, Number, Multiple Choice, Dropdown, Audio, Audio or Text, Video, File Upload, Play Media,
  Geolocation`. A single-choice question (most binary questions: "Are you willing to work onsite?")
  is `Dropdown`, not `Multiple Choice` — reserve `Multiple Choice` for questions that genuinely allow
  picking more than one option. Use `Text` whenever the source gives no closed list of choices to
  infer from, even for a question that's *conceptually* closed-ended (e.g. "highest educational
  attainment") — inferring plausible options for those would be inventing data. Flag it in that
  question's `clientComments` instead, e.g. "Source didn't specify choices — needs the client's
  actual list before this can be a proper Dropdown."
- **`answerOptions`**: only set this when the question itself implies the options (a yes/no question
  → `"Yes, No"`). Leave blank otherwise.
- **`approved`**: `true` only where the source shows `☑ Approved` for that row.
- **`clientComments`**: carry over the source's own comment for that row if present, in addition to
  any flag you're adding per the point above.
- The source often also has a second, empty "additional or preferred questions" section for the
  client to fill in themselves — leave it alone; there's nothing to transcribe there.

## 3. Agent 1–4 sheets → one form-based custom tab EACH

Same four fields on every agent tab, in this order:

- **"Main Script"** (richtext) — the verbatim script text. Preserve the source's leading-space
  indentation and `[If Yes]/[If No] ->` branch markers as literal line breaks; do not flatten the
  branching into prose paragraphs. A `richtext` field is plain text with line breaks today (no bold/
  lists/highlighting) — that's a known, accepted limitation, not something to work around.
- **"Scheduling Script"** (richtext) — same rule, for the sheet's separate scheduling-script section.
- **"Approve the script above as-is?"** (checkbox) — set from the source's own approval cell for that
  sheet (`☑ Approved` → `true`, anything else → `false`).
- **"Your preferred script (optional, only if you want to change the sample above)"** (richtext) —
  left blank. It's a space for the client to write their own version, not something to fill in.

A sparse note in a side column next to the script (e.g. "AI agent will not reject candidates on the
spot.") is a Talkpush-internal instruction, not something the AI says out loud. Fold it into the
script text as an inline `[Note: ...]` at the exact point it occurs, rather than putting it in a
separate field or, worse, making it look like dialogue.

## 4. Call Handling → one form-based custom tab

Two `table`-type fields:

- **"If nobody answers"** — plain text columns: `Question`, `Your answer`. This section is usually
  already filled in by Talkpush in the source (retry policy, etc.), not left for the client.
- **"If the candidate answers"** — typed columns: `Scenario` (text), `How it's handled` (textarea),
  `Approved?` (checkbox), `<Client> Comments` (textarea).

## 5. FAQ Content → one plain table-based custom tab (`columns`/`rows`, no `fields` needed)

Columns: `Category` (text), `Sample answer` (textarea), `Your answer` (textarea), `Approved?`
(checkbox), `<Client> Comments` (textarea). This sheet has no structural gap — it was already a
straightforward grid in the source.

Watch for a stray comment that landed in a column with no header at all (this happened in the
Inspiro file — a note sat in a column past the table's declared header row). Still capture it into
the Comments column for that row rather than dropping it just because it wasn't where a header said
comments should be.

## 6. "\<Client\> Sign-off" → one form-based custom tab

- **"Approved by"** (text), **"Date"** (date), **"Notes / changes requested"** (textarea) — all left
  blank; this is the client's sign-off to complete, not Talkpush's.
- Each row under the sheet's "Success Metrics" heading (typically Pickup Rate, Completion Rate,
  Average Call Duration, but read the actual labels from the file rather than assuming these three)
  becomes its own blank text field, with a placeholder noting it's filled in after go-live — the
  source has no values for these yet by design.

## If a file doesn't match this shape

A sheet renamed, missing, or restructured beyond what's described here is a signal to stop and ask,
not to force it into the closest mapping above. The whole point of detecting structure by label
rather than position is resilience to *minor* drift (a shifted row, an extra blank line) — a
genuinely different shape (a 5th agent, a merged sheet, a table where a document was expected) means
the mapping itself may need to change, which is a decision for the user, not something to improvise.
