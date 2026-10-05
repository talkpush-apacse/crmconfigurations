/* eslint-disable @typescript-eslint/no-explicit-any -- ad-hoc JSON-RPC payloads in a developer smoke script */
/**
 * Smoke test for the Project Tracker MCP endpoint, talking JSON-RPC over HTTP
 * exactly as a Claude connector does.
 *
 *   TRACKER_MCP_API_KEY=... npx tsx scripts/smoke-tracker-mcp.ts [http://localhost:3000]
 *
 * Refuses to run against anything but localhost. It creates a clearly named
 * "MCP smoke test" account and project and leaves them behind (the local
 * database is disposable).
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const key = process.env.TRACKER_MCP_API_KEY ?? "";
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: ${host} is not localhost.`);
  process.exit(1);
}
if (!key) {
  console.error("Set TRACKER_MCP_API_KEY.");
  process.exit(1);
}

const run = Date.now().toString(36);
const PROJECT = `MCP smoke project ${run}`;
const STAFF = `Smoke Staff ${run}`;
const CLIENT = `Smoke Client ${run}`;
let id = 0;
async function rpc(method: string, params: unknown, auth = true): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}/api/mcp/tracker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(auth ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body };
}

async function tool(name: string, args: Record<string, unknown>) {
  const { status, body } = await rpc("tools/call", { name, arguments: args });
  const result = body?.result;
  const text: string = result?.content?.[0]?.text ?? JSON.stringify(body);
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* plain text error */
  }
  return { status, isError: !!result?.isError, data };
}

let failures = 0;
function check(label: string, pass: boolean, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!pass) failures++;
}

async function main() {
  const noAuth = await rpc("tools/list", {}, false);
  check("rejects a request without the key", noAuth.status === 401, `HTTP ${noAuth.status}`);

  const list = await rpc("tools/list", {});
  const names: string[] = (list.body?.result?.tools ?? []).map((t: any) => t.name);
  check("lists the tracker tools", names.includes("update_item_status") && names.includes("get_project_summary"), `${names.length} tools`);
  check("has no delete tool", !names.some((n) => /delete|remove_item|destroy/i.test(n)));

  const acct = await tool("create_account", { name: `MCP smoke test ${run} (safe to delete)` });
  check("create_account", !acct.isError && !!acct.data.id);
  const created = await tool("create_project", {
    account: acct.data.id,
    title: PROJECT,
    start_date: "2026-10-01",
    target_date: "2026-12-01",
  });
  check("create_project", !created.isError && !!created.data.id, created.data.title);
  const projectId: string = created.data.id;

  const staff = await tool("create_person", { name: STAFF, side: "talkpush" });
  const contact = await tool("create_person", { name: CLIENT, side: "client", account: acct.data.id });
  check("create_person (staff and client)", !staff.isError && !contact.isError);

  const bad = await tool("add_open_items", { project_id: projectId, items: [{ title: "Should not exist", owner: "Nobody Atall" }] });
  check("a bad owner name creates nothing", bad.isError, String(bad.data).slice(0, 70));

  const add = await tool("add_open_items", {
    project_id: projectId,
    items: [
      { title: "Whitelist sender domain", owner: CLIENT, due_date: "2026-10-20", phase: "Configuration" },
      { title: "Go-live", owner: STAFF, is_milestone: true, due_date: "2026-11-30", blocked_by: ["Whitelist sender domain"], visibility: "internal" },
    ],
  });
  check("add_open_items with a dependency inside the batch", !add.isError && add.data.created?.length === 2);
  check("the dependency was recorded", (add.data.created?.[1]?.blockedByItemIds ?? []).length === 1);

  const noReason = await tool("update_item_status", { project_id: projectId, item: "whitelist", status: "blocked" });
  check("blocked without a reason is refused", noReason.isError, String(noReason.data).slice(0, 70));
  const blocked = await tool("update_item_status", {
    project_id: projectId,
    item: "Whitelist sender domain",
    status: "blocked",
    blocker_reason: "Client IT change window",
    remark: "Raised with Ben",
  });
  check("update_item_status by title (blocked, with remark)", !blocked.isError && blocked.data.status === "blocked");

  const loop = await tool("set_item_dependency", { project_id: projectId, item: "Whitelist sender domain", blocked_by: ["Go-live"] });
  check("a dependency loop is refused", loop.isError, String(loop.data).slice(0, 70));

  const metric = await tool("add_success_metric", {
    project_id: projectId,
    name: "Time to hire",
    unit: "days",
    direction: "lower_is_better",
    baseline_value: 21,
    baseline_date: "2026-10-01",
    target_value: 14,
  });
  check("add_success_metric", !metric.isError && !!metric.data.id);
  const reading = await tool("record_metric_reading", { project_id: projectId, metric: "time to hire", value: 18, as_of: "2026-10-15" });
  check("record_metric_reading updates the current value", !reading.isError && reading.data.currentValue === 18);

  const summary = await tool("get_project_summary", { project: PROJECT });
  const s = summary.data;
  check("get_project_summary by name", !summary.isError && s.project?.title === PROJECT);
  check("summary says what is blocked", (s.needsAttention?.blocked ?? []).length === 1, s.headline);
  check("summary shows the metric", (s.metrics ?? []).some((m: any) => m.name === "Time to hire" && m.current === 18));
  check("activity shows changes came from MCP", (s.recentActivity ?? []).some((a: any) => a.via === "mcp"));

  const archived = await tool("archive_item", { project_id: projectId, item: "Go-live" });
  check("archive_item", !archived.isError);
  const open = await tool("list_open_items", { project_id: projectId });
  check("archived item no longer listed", Array.isArray(open.data) && open.data.length === 1);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
