# Configuration plan (read-only)

For one client, the plan lists what to create in the Talkpush CRM, built from the captured **CRM Config Checklist**
and the **Process Workflow**. It describes work. It never writes to the checklist or to any CRM.

## Where to use it
- **Claude:** the `get_config_plan` tool on the combined connector (`/api/mcp/all`). Inputs: the checklist (slug or id),
  optionally the workflow (id or name), the version (`published` by default, falling back to the current draft with a warning),
  and `detail` (`summary` or `full`).
- **Website:** a project that is linked to a checklist has a **Config plan** button (`/admin/tracker/projects/<id>/config-plan`).
  Pick the workflow and version, read the plan, or copy it as Markdown.

## What it does
1. Reads the checklist rows (deleted and "not applicable" rows are skipped).
2. Reads every page of the workflow. A name in a dedicated field (`targetFolder`, `messageTemplate`, `integrationSystem`) is reliable.
   A name read from a step's title is marked "check it". A step that needs something but names nothing is listed under
   "Needs a decision"; a name is never invented.
3. Matches names after tidying case, punctuation and spacing. Close but different names are shown side by side; never merged.
4. Orders the objects by their CRM dependencies and says how each is configured: Claude can create it, by hand, or ticket.
5. Lists what the workflow has that the checklist lacks. Adding those to the checklist is a separate step that needs a person's yes
   (use the existing checklist tools, for example the folder and template ones). The plan never does it for you.

## Safety
- Only an allow-list of fields is read (`src/lib/config-plan/from-checklist.ts`). Contact details, integration endpoints and
  credentials, and the whole admin-settings block are never read. `tests/config-plan.test.ts` plants secrets and checks none appear.
- The tool and route are read-only. There is no database change.

## Keeping it right
- **Which CRM tools exist** is a table in `src/lib/config-plan/spec.ts` (`SECTION_SPECS`). The Talkpush CRM connector is a
  separate server this app cannot see, so correct that table when a tool is added or removed there.
- Code: `src/lib/config-plan/` (rules), `src/lib/mcp/config-plan/` (the tool), `src/components/tracker/ConfigPlanView.tsx` (the screen).
