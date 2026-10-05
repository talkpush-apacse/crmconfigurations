# Timeline and Gantt charts

Two directions. Both need Jolo's yes on a table before anything is written.

## A. Draw a Gantt from the tracker (slide or PDF)

1. `get_project_timeline` gives project dates, every phase with start and end, and every item with phase, owner, start,
   due, milestone flag, status and what it waits for. Items with no dates cannot be drawn: list them under the chart
   as "not scheduled yet" instead of guessing dates.
2. Build the file with the `pptx` or `pdf` skill, whichever Jolo asked for. One chart per page or slide, landscape.
3. **Always include a dates table** (the slide or page after the chart): one row per phase and item with columns
   `Phase | Item | Owner | Start | Due | Milestone | Waits for`, dates written `YYYY-MM-DD`. The bars are for people;
   the table is what Claude reads back later, and it removes any doubt about where a bar starts or ends.
4. Chart conventions: weeks across the top, phases as shaded group rows, items as bars, milestones as diamonds,
   today as a vertical line, dependencies named in the table rather than drawn as arrows.
5. Tell Jolo to upload the file in the project's **Settings, Files, kind "Timeline / Gantt"** so the team keeps a copy.
   Claude cannot open stored files, only list their names (`list_project_files`).

## B. Build the timeline from a Gantt Jolo gives you

1. Find the project (`list_tracker_projects`), then `get_project_timeline` so you know what already exists.
2. Read the Gantt the user attached in the chat. **Take dates from the dates table** if there is one. If there is only a
   chart, read bars to the nearest day the scale allows, and say which dates are estimates from the picture.
3. **Show a table first and wait for an explicit yes.** Columns: `Action (add / update / leave) | Phase | Item | Owner |
   Start | Due | Milestone | Waits for`. Match existing phases and items by name; never create a second copy of
   something that already exists. Put anything you could not read, or could not match to a person, in an
   "I need you to confirm" list.
4. After the yes, write in this order so every name resolves:
   1. `add_phases` for phases that do not exist yet (they are added after the existing ones, in the order given).
   2. `update_phase` for phases whose dates changed.
   3. `add_open_items` for new items (`phase`, `owner`, `start_date`, `due_date`, `is_milestone`, `blocked_by`).
      Owners must already exist (`list_people`); if one does not, ask, do not invent a person.
   4. `update_item` for existing items whose dates, phase or owner changed.
5. **Project dates.** Moving the project's `target_date` counts as a reschedule and is shown to clients as
   "moved N times". Do not change it without saying so and getting a yes. Setting a start date is fine.
6. Defaults that protect Jolo: new items are `visibility: "internal"` unless Jolo says the client should see them.
   Say that you did this, so the client-facing timeline is not a surprise.
7. Finish by re-reading with `get_project_timeline` and reporting what the tracker now holds, counting phases and
   items added and changed. Remind Jolo to upload the Gantt file (Settings, Files, "Timeline / Gantt").

## What goes wrong

- A bar that sits between two weeks: ask, or state the date you chose.
- Two items with the same title: the tools refuse to guess. Rename one in the table before writing.
- A phase the Gantt calls something slightly different ("Config" vs "Configuration"): ask whether it is the same phase.
