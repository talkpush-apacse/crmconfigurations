# Worked example: the actual Inspiro import

This is the real pattern that produced Inspiro's production checklist, kept as something to adapt —
not a template to fill in blank by blank. The extraction script below is a cleaned-up, label-detecting
version of what was actually run (the original used row numbers found by eyeballing the file first;
this version detects the same structure by header text, which holds up better against a new client's
file having a slightly different row layout).

## Extracting Global Agent Settings, Call Handling, and FAQ Content (label-detected)

```python
import openpyxl, json

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

def col(ws, letter, row):
    v = ws[f"{letter}{row}"].value
    if v is None:
        return ""
    # A cell that's a genuine Excel number (e.g. "how many attempts?" -> 3) comes back from
    # openpyxl as a Python float even when it displays as a whole number in the sheet — coerce
    # a whole-number float to a clean string ("3", not "3.0") before it lands in a text field.
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return v

def find_row(ws, label, col_letter="A", start=1, end=None):
    """First row whose cell (trimmed) equals `label`."""
    end = end or ws.max_row
    for r in range(start, end + 1):
        v = ws[f"{col_letter}{r}"].value
        if v is not None and str(v).strip() == label:
            return r
    raise ValueError(f'label "{label}" not found in {ws.title}')

def rows_until_blank(ws, start_row, value_col="A"):
    """Rows from start_row until the first fully-blank row in `value_col`."""
    r = start_row
    out = []
    while ws[f"{value_col}{r}"].value not in (None, ""):
        out.append(r)
        r += 1
    return out

# --- Global Agent Settings ---
ws = wb["Global Agent Settings"]
glance_header = find_row(ws, "Agent")  # header row of "4 agents at a glance"
agents_glance = [
    {"agent": col(ws, "A", r), "when": col(ws, "B", r), "what": col(ws, "C", r)}
    for r in rows_until_blank(ws, glance_header + 1)
]
settings_header = find_row(ws, "Setting")
settings = [
    {
        "setting": col(ws, "A", r), "value": col(ws, "B", r), "notes": col(ws, "C", r),
        "approved": col(ws, "D", r) == "☑ Approved",
        "comments": col(ws, "E", r),
    }
    for r in rows_until_blank(ws, settings_header + 1)
]

# --- FAQ Content ---
ws = wb["FAQ Content (OPTIONAL)"]
faq_header = find_row(ws, "Category")
faq = [
    {
        "category": col(ws, "A", r), "sample_answer": col(ws, "B", r), "your_answer": col(ws, "C", r),
        "approved": col(ws, "D", r) == "☑ Approved",
        # Inspiro had one stray comment sitting in column F despite no header there — still
        # captured it. Check both E and F for a client's file; don't assume the "no header"
        # anomaly repeats, but don't assume it can't either.
        "comments": col(ws, "E", r) or col(ws, "F", r),
    }
    for r in rows_until_blank(ws, faq_header + 1)
]
```

## Extracting an Agent script tab (indentation-aware)

```python
def section_text(ws, start_row, end_row):
    """Joins column-A lines from start_row (exclusive of header) to end_row (exclusive),
    folding any column-E note into an inline [Note: ...] at that line."""
    lines = []
    for r in range(start_row, end_row):
        a = ws[f"A{r}"].value
        if a is None or str(a).strip() == "":
            continue
        line = str(a)
        e = ws[f"E{r}"].value
        if e:
            line += f"  [Note: {str(e).strip()}]"
        lines.append(line)
    return "\n".join(lines)

ws = wb["Agent 1 - Pre-Screening"]
main_header = find_row(ws, "Main Script")          # or "AI Agent script" on Agent 2/4, "Sample script" on Agent 3
sched_header = find_row(ws, "Scheduling Script")
approve_row = find_row(ws, "Approve the script above as-is?")
pref_header = find_row(ws, "Your preferred script (optional, only if you want to change the Sample above)")

main_script = section_text(ws, main_header + 1, sched_header - 1)
scheduling_script = section_text(ws, sched_header + 1, approve_row)
approve_value = ws[f"D{approve_row}"].value  # "☑ Approved" or "☐ Pending"
```

Note the header label for the first script section differs by agent ("Main Script" vs. "AI Agent
script" vs. "Sample script") — search for whichever is actually present rather than assuming one
fixed label; a simple approach is to treat the first section header in the sheet (before "Scheduling
Script") as the main script's header, whatever it's literally called.

## Populating via MCP (the actual call sequence used)

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/lib/mcp-server";

const SLUG = "inspiro"; // the checklist's slug, from create-checklist.ts's output

async function main() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "populate", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  async function call(name: string, args: Record<string, unknown>) {
    const res: any = await client.callTool({ name, arguments: args });
    const text = res.content?.[0]?.text ?? "";
    if (res.isError) throw new Error(`${name} failed: ${text}`);
    console.log(`=== ${name} OK ===\n${text}\n`);
  }

  await call("add_prescreening_questions", { slug: SLUG, questions: [ /* from tab-mapping.md rule 2 */ ] });

  await call("add_custom_tab", {
    slug: SLUG,
    tab_name: "Global Agent Settings",
    tab_description: "The 4 AI voice call agents at a glance, plus the settings used across all of them.",
    tab_icon: "Settings",
    fields: [
      {
        label: "The 4 agents at a glance",
        type: "table",
        tableColumns: [
          { key: "agent", label: "Agent", type: "text" },
          { key: "when_it_calls", label: "When it calls", type: "text" },
          { key: "whats_it_for", label: "What it's for", type: "text" },
        ],
        initialValue: agentsGlance, // mapped from the extracted rows
      },
      {
        label: "Settings",
        type: "table",
        tableColumns: [
          { key: "setting", label: "Setting", type: "text" },
          { key: "value", label: "Value", type: "text" },
          { key: "notes", label: "Notes", type: "textarea" },
          { key: "approved", label: "Approved?", type: "checkbox" },
          { key: "client_comments", label: `${CLIENT_NAME} Comments`, type: "textarea" },
        ],
        initialValue: settingsRows,
      },
    ],
  });

  // ...one add_custom_tab per Agent 1-4, Call Handling, FAQ Content, "<Client> Sign-off" —
  // see tab-mapping.md for each shape. Same `call()` helper throughout.
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run it with the target database explicit, e.g. against production:

```bash
DATABASE_URL_DIRECT="$(grep '^DATABASE_URL_DIRECT=' .env.local | cut -d= -f2- | tr -d '"')" npx tsx path/to/populate-script.ts
```

If the very first call fails with a transaction/connection timeout, that's usually a transient
connection-establishment blip talking to a remote database — nothing was written yet, so just retry
the same command.

## Self-audit (the actual verification used)

```ts
import { prisma } from "./src/lib/db"; // adjust relative path

const c = await prisma.checklist.findUnique({ where: { slug: SLUG } });
const customTabs = c!.customTabs as any[];
const customData = c!.customData as Record<string, unknown>;
console.log(`Custom tabs: ${customTabs.length} (expect N)`);
for (const tab of customTabs) {
  if (tab.columns === undefined) {
    // form-based: check each field's stored value via customData[field.id]
    for (const f of tab.fields) console.log(tab.label, f.label, customData[f.id]);
  } else {
    console.log(tab.label, `${tab.rows.length} rows (expect N)`);
  }
}
```

Compare every count and every `approved` value against what was extracted in step 2 — not just that
the script ran without error.

## Cleanup

Every script above is a one-off — delete it after the run (`rm path/to/script.ts`), the same way the
scripts that produced this example were deleted once Inspiro's checklist was verified. Don't leave
throwaway population scripts committed in the repo.
