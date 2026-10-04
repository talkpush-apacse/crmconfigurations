import test from "node:test";
import assert from "node:assert/strict";
import { channelLabel, channelWhen } from "../src/lib/workflow/process-map/channel";
import { boxFor } from "../src/lib/workflow/process-map/text-fit";
import { graphFromFlowTable } from "../src/lib/workflow/flow-table-import";
import { deriveFlowTable, flowTableCsv } from "../src/lib/workflow/process-map/flow-table";
import { runGapCheck } from "../src/lib/workflow/gap-check";
import { applyLayout, layoutProcessMap } from "../src/lib/workflow/process-map/layout";
import { buildScene } from "../src/lib/workflow/process-map/scene";
import { lintLayout } from "../src/lib/workflow/process-map/lint";
import { edge, end, note, person, start, system } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
const withData = (n: any, data: Record<string, unknown>) => ({ ...n, data: { ...n.data, data: { ...(n.data.data ?? {}), ...data } } });
const withTiming = (n: any, timing: string) => ({ ...n, data: { ...n.data, timing } });

test("channel label: known channels get friendly names, several join with +, anything else is kept as typed", () => {
  assert.equal(channelLabel("email"), "Email");
  assert.equal(channelLabel("sms"), "SMS");
  assert.equal(channelLabel("voice"), "Voice call");
  assert.equal(channelLabel("whatsapp"), "WhatsApp");
  assert.equal(channelLabel(["email", "sms"]), "Email + SMS");
  assert.equal(channelLabel("Email + SMS"), "Email + SMS");
  assert.equal(channelLabel("email, sms"), "Email + SMS");
  assert.equal(channelLabel("email and SMS"), "Email + SMS");
  assert.equal(channelLabel("Microsoft Teams"), "Microsoft Teams", "a client's own channel is never rewritten or rejected");
  assert.equal(channelLabel("email + email"), "Email");
  assert.equal(channelLabel(undefined), "");
  assert.equal(channelLabel("  "), "");
});

test("channel and when: shown as 'Channel · When', either alone, or nothing", () => {
  const msg = system("m", "Sends rejection notice", "message");
  assert.equal(channelWhen(withTiming(withData(msg, { channel: "email" }), "1 hour after")), "Email · 1 hour after");
  assert.equal(channelWhen(withData(msg, { channel: ["email", "sms"] })), "Email + SMS");
  assert.equal(channelWhen(withTiming(msg, "immediately")), "immediately");
  assert.equal(channelWhen(msg), "");
});

test("the box draws Channel · When as its italic last line, for automated steps and for any step with a timing", () => {
  const msg = withTiming(withData(system("m", "Sends rejection notice", "message"), { channel: "sms" }), "2 days after");
  const lines = boxFor(msg).lines;
  const last = lines[lines.length - 1].runs[0];
  assert.equal(last.text, "SMS · 2 days after");
  assert.equal(last.italic, true);
  // a manual step with only a timing is unchanged
  const manual = withTiming(person("p", "Reviews profile", "RECRUITER"), "The day before the interview");
  const manualLast = boxFor(manual).lines.at(-1)!.runs[0];
  assert.equal(manualLast.text, "The day before the interview");
  assert.equal(manualLast.italic, true);
  // nothing set: no extra line
  const bare = boxFor(system("b", "Sends rejection notice", "message")).lines;
  assert.ok(bare.every((l) => !l.runs[0].italic));
});

test("flow table import: channel and timing reach the step, several channels joined", () => {
  const { nodes, problems } = graphFromFlowTable([
    { step: "1", actor: "Talkpush", action: "Sends rejection notice", actionType: "Message", channel: "Email", timing: "1 hour after" },
    { step: "2", actor: "Talkpush", action: "Sends reminder", actionType: "Message", channel: ["Email", "SMS"], timing: "2 days after" },
    { step: "3", actor: "Talkpush", action: "Moves to Rejected", actionType: "Move" },
  ]);
  assert.deepEqual(problems, []);
  assert.equal(nodes[0].data.channel, "Email");
  assert.equal(nodes[0].timing, "1 hour after");
  assert.equal(nodes[1].data.channel, "Email + SMS");
  assert.equal(nodes[2].data, undefined, "no channel given: no metadata invented");
});

test("derived flow table: a Channel · When column appears only when some step has one", () => {
  const plain = [start("s", "Entry"), system("a", "Moves to Rejected", "move"), end("e", "Rejected", "failure")];
  const plainEdges = [edge("e1", "s", "a"), edge("e2", "a", "e")];
  assert.ok(!deriveFlowTable(plain, plainEdges).columns.includes("Channel · When"), "older tables read as before");

  const nodes = [start("s", "Entry"), withTiming(withData(system("a", "Sends rejection notice", "message"), { channel: "email" }), "1 hour after"), end("e", "Rejected", "failure")];
  const edges = [edge("e1", "s", "a"), edge("e2", "a", "e")];
  const table = deriveFlowTable(nodes, edges);
  assert.deepEqual(table.columns, ["Step", "Actor", "Action", "Action Type", "Channel · When", "Branch / Condition"]);
  assert.equal(table.rows[0].channelWhen, "Email · 1 hour after");
  assert.match(flowTableCsv(table), /Email · 1 hour after/);
});

test("gap check: an automated message, call or alert with no channel or no timing is listed, naming what is missing", () => {
  const tail = (n: any) => ({ nodes: [start("s", "Entry"), n, end("e", "Done", "success")], edges: [edge("e1", "s", n.id), edge("e2", n.id, "e")] });
  const find = (n: any) => {
    const { nodes, edges } = tail(n);
    return runGapCheck(nodes, edges).filter((f) => f.code === "comm_channel_or_timing_missing");
  };
  const msg = system("m", "Sends rejection notice", "message");
  const both = find(msg);
  assert.equal(both.length, 1);
  assert.match(both[0].message, /which channel it uses or when it goes out/);
  assert.equal(both[0].tier, "assumption");
  assert.match(both[0].assumption ?? "", /Assumed it is sent by email and straight away\. If incorrect/);

  assert.match(find(withData(msg, { channel: "email" }))[0].message, /when it goes out/);
  assert.match(find(withTiming(msg, "immediately"))[0].message, /which channel it uses/);
  assert.equal(find(withTiming(withData(msg, { channel: "email" }), "1 hour after")).length, 0, "complete: not listed");
  assert.equal(find(system("a", "Notifies the hiring manager", "alert")).length, 1, "internal alerts too");
  assert.equal(find(system("c", "Calls to confirm", "call")).length, 1, "and calls");
  assert.equal(find(system("m2", "Moves to Hired", "move")).length, 0, "a folder move is not a message");
  assert.equal(find(person("p", "Sends the offer", "RECRUITER", { actionType: "message" })).length, 0, "a person sending something is a manual step, not an automated one");
});

test("an info note stating a time satisfies the timing check; an orange to-confirm note does not", () => {
  const msg = withData(system("m", "Sends reminder", "message"), { channel: "sms" });
  const attach = (n: any) => ({ ...n, data: { ...n.data, attachTo: "m" } });
  const run = (extra: any[]) => runGapCheck([start("s", "Entry"), msg, end("e", "Done", "success"), ...extra], [edge("e1", "s", "m"), edge("e2", "m", "e")]).filter((f) => f.code === "comm_channel_or_timing_missing").length;
  assert.equal(run([]), 1);
  assert.equal(run([attach(note("n", "Cadence", "Reminders after 1 hour, 3 hours and 24 hours."))]), 0);
  assert.equal(run([attach(note("n", "To confirm", "How long after?", "needs_input"))]), 1);
});

test("a box with an extra Channel · When line still lays out cleanly", () => {
  const nodes = [
    start("s", "Entry"),
    withTiming(withData(system("a", "Sends rejection notice", "message"), { channel: "email + sms" }), "1 hour after"),
    withTiming(withData(system("b", "Reminder to book", "message"), { channel: "sms" }), "2 days after"),
    end("e", "Done", "success"),
  ];
  const edges = [edge("e1", "s", "a"), edge("e2", "a", "b"), edge("e3", "b", "e")];
  const laid = applyLayout(nodes, edges, layoutProcessMap(nodes, edges));
  const findings = lintLayout(buildScene(laid.nodes, laid.edges, { clientName: "C", workflowName: "W", versionLabel: "v1", date: "2026-10-04", author: "T" }));
  assert.deepEqual(findings.filter((f) => f.severity === "high"), []);
});
