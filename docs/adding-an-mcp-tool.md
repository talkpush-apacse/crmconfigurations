# Adding or changing an MCP tool

Tools are what Claude can do through a connector. Each tool is one `defineTool({...})` in a module folder.
You never touch the routes, the key check, the error handling or the tool list in the docs: those come from the
toolkit (`src/lib/mcp/toolkit.ts`).

## Where things live

| What | Where |
|---|---|
| The toolkit (`defineTool`, error handling, building a server) | `src/lib/mcp/toolkit.ts` |
| Which modules exist | `src/lib/mcp/modules.ts` |
| Project Tracker tools | `src/lib/mcp/tracker/read-tools.ts` (reads), `write-tools.ts` (changes data), `helpers.ts` (name lookups) |
| CRM Config Checklist tools (46, not yet moved to the toolkit) | `src/lib/mcp-server.ts`, in `registerChecklistTools` |
| The generated tool list for the tracker | `.claude/skills/project-tracker-mcp/references/tools.md` (do not edit by hand) |

## One URL for everything: the combined connector

`/api/mcp/all` serves the checklist, tracker and workflow tools together (`src/lib/mcp/combined.ts`). The three
single-area URLs (`/api/mcp`, `/api/mcp/tracker`, `/api/mcp/workflows`) still work, so existing connections keep working.

- **Adding a tool to an existing area:** nothing extra. Add it to that area's module as above and it appears on both
  its own URL and the combined one.
- **Adding a whole new area:** make its `ToolModule`, then add it to `combinedModules` in `src/lib/mcp/combined.ts`
  (and, if it should also have its own URL, copy one of the small routes in `src/app/api/mcp/`). Add the new path to
  `RESOURCES` in `src/app/.well-known/oauth-protected-resource/[[...path]]/route.ts` if it needs its own sign-in entry.
- **Names must be unique across all areas.** The server refuses to start otherwise, and `tests/mcp-combined.test.ts` checks it.
- **Sign-in:** people connect with Claude sign-in (OAuth); the same sign-in works on every URL. The optional key for scripts
  is `COMBINED_MCP_API_KEY` (header only). The checklist, tracker and workflow keys are NOT accepted on the combined URL.

## Add a tool to the tracker (5 steps)

1. **Write the tool** in `read-tools.ts` (it only looks) or `write-tools.ts` (it changes something):

   ```ts
   export const listOverdueItemsTool = defineTool({
     name: "list_overdue_items",                     // snake_case, unique
     description: "List items past their due date across all projects, oldest first.",
     access: "read",                                  // "read" or "write"
     input: {
       account: z.string().optional().describe("Only this account's projects"),
     },
     handler: async ({ account }, ctx) => {
       // Call the same service functions the website uses (src/lib/tracker/*).
       // Return plain data. Throw badRequest("...") or notFound("...") for problems the user can fix.
       return [];
     },
   });
   ```

2. **Add it to the list** at the bottom of the same file (`trackerReadTools` or `trackerWriteTools`).
3. **Regenerate the docs:** `npm run mcp:docs`
4. **Run the tests:** `npm test`. They check that the name is unique, the description is real, the tool is tagged
   read or write, there is no delete tool, and the generated docs match.
5. **Try it on a preview** with a real Claude connection before you rely on it.

## Rules the tests and reviews hold you to

- **Reuse the service layer.** Rules such as "blocked needs a reason" live in `src/lib/tracker/*`, so the website and Claude
  can never disagree. A tool should not talk to the database directly for anything that has a rule.
- **No delete.** Use an archive. Tool names containing `delete`, `destroy`, `purge`, `drop` or `truncate` fail the tests.
- **Write tools log who did it.** Pass `ctx.actor` to the service function, never a hard-coded name. For a person who connected through sign-in it reads "Claude for <email>"; for the shared key it reads "Claude (MCP)".
- **Visibility.** Anything a client could see must say so in its description, and defaults must be the safe one.
- **Describe fields** Claude could mistake: dates (`YYYY-MM-DD`), names versus ids, what `null` does.
- **Errors.** Throw a `TrackerError` (`badRequest`, `notFound`) for a message a person can act on. Any other error shows
  "Something went wrong" and the detail goes to the server log only, so nothing internal leaks.
- **Renaming or removing a tool breaks anyone who relies on it.** Add the new one first and tell people.

## Add a whole new area (a new module)

1. Create `src/lib/mcp/<area>/index.ts` exporting a `ToolModule` (id, name, instructions, `tools: [...]`,
   optionally `isUserError` and `logPrefix`). Copy `src/lib/mcp/tracker/index.ts`.
2. Add it to `MCP_MODULES` in `src/lib/mcp/modules.ts`.
3. Decide which connector serves it. Today `/api/mcp` serves the checklist and `/api/mcp/tracker` serves the tracker.
   A module only appears on a connector whose route builds it in.

## Moving a checklist tool onto the toolkit later

Cut one `server.tool(...)` out of `registerChecklistTools`, rewrite it as a `defineTool` in a new
`src/lib/mcp/checklist/` module, add it to that module's `tools`, and remove it from the legacy function. The checklist's
tool list must stay identical: compare `tools/list` before and after.
