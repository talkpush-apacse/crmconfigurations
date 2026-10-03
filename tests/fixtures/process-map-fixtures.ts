/**
 * Two realistic Process Map diagrams, modelled on the structure of Jolo's reference diagrams
 * (MyPal v3 and Teleperformance v5.1): a main path, forks that drop branches, nested forks, jump markers,
 * terminators of every kind, notes, and a table. Positions are left at zero on purpose: the layout engine places them.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = Record<string, any>;

export function step(id: string, label: string, data: Data = {}, type = "stage"): any {
  return { id, type, position: { x: 0, y: 0 }, data: { label, type, notes: "", actor: "automated", ...data } };
}
export const person = (id: string, label: string, role: string, data: Data = {}) => step(id, label, { actor: "manual", actorLabel: role, personActs: true, ...data }, "manual_action");
export const system = (id: string, label: string, actionType: string, data: Data = {}) => step(id, label, { actor: "automated", actionType, ...data });
export const decision = (id: string, label: string, data: Data = {}) => step(id, label, { actor: "automated", ...data }, "decision");
export const start = (id: string, label: string) => step(id, label, { actor: "source" }, "source");
export const end = (id: string, label: string, endKind: string) => step(id, label, { endKind }, "terminator");
export const jump = (id: string, toNodeId: string) => step(id, "Go to step", { jumpToNodeId: toNodeId }, "jump");
export const note = (id: string, heading: string, body: string, noteKind = "info") => step(id, heading, { noteKind, notes: body }, "note");

export function edge(id: string, source: string, target: string, label = "", data: Data = {}): any {
  return { id, source, target, type: "custom", data: { label, ...data } };
}
const main = (id: string, s: string, t: string, label = "") => edge(id, s, t, label, { isPrimary: true, isHappyPath: true, pathSemantic: "happy" });

/** A MyPal-style portal report flow: 3-way fork near the start, a 3-way fork later with a nested fork. */
export function myPalLike() {
  const nodes = [
    start("src", "Employee has a concern"),
    person("s1", "Opens the portal and picks how to report", "REPORTER"),
    decision("d2", "Choose how to report"),
    person("a1", "Anonymous: nothing identifying is stored", "REPORTER"),
    system("a1j", "", "system"),
    person("b1", "Confidential: gives a phone or email", "REPORTER"),
    person("b2", "The system sends a one-time code", "REPORTER"),
    person("c1", "Shares name, employee ID and contact", "REPORTER"),
    person("s3", "Fills the report", "REPORTER"),
    system("s4", "Creates the case with a case number", "add_data"),
    step("s5", "Shows the confirmation screen", { actor: "automated", shapeKind: "display" }),
    system("s6", "Instant acknowledgement by SMS or email", "message"),
    system("s7", "Assigns the HRSP from the category and region", "add_data"),
    decision("d8", "Is a handler found and is there no conflict?"),
    system("n8", "No mapping found or the handler is conflicted", "add_data"),
    decision("d9", "Valid report? Stage: Under review"),
    system("r9", "Handler logs why it is invalid", "rejection_reason"),
    person("s10", "Investigates and adds internal notes", "HANDLER", { actionType: "system" }),
    decision("d11", "Can the handler resolve it?"),
    person("p11a", "Writes the question to the reporter", "HANDLER", { actionType: "message" }),
    decision("d11a", "Reply within 7 days?"),
    person("p11a1", "Replies with the information", "REPORTER"),
    system("p11a2", "Auto-closes at 7 days with no reply", "move"),
    person("p11b", "Not resolvable yet: reminder sent", "HANDLER", { actionType: "alert" }),
    person("p11c", "Escalates beyond the handler", "HANDLER, then LEAD"),
    person("s12", "Marks resolved and records the outcome", "HANDLER"),
    system("s13", "SMS: resolved, check result", "message"),
    decision("d14", "Reporter satisfied?"),
    person("n14", "Gives the reason in free text", "REPORTER"),
    end("e_ok", "Closed", "success"),
    end("e_bad", "Closed as invalid", "failure"),
    end("e_bad2", "Closed, reporter failed to respond", "failure"),
    jump("j_a", "s3"),
    jump("j_b", "s3"),
    jump("j_c", "s3"),
    jump("j_n8", "s7"),
    jump("j_p11a1", "s10"),
    jump("j_p11b", "s10"),
    jump("j_p11c", "s10"),
    jump("j_n14", "s10"),
    note("note1", "To confirm with McDonald's PH", "Who can see all reports? What is the escalation path?", "needs_input"),
    note("note2", "Note", "Anonymous: also types the last 4 characters of the case ID.", "info"),
  ];
  // jump marker "a1j" above is a placeholder removed below
  const keep = nodes.filter((n) => n.id !== "a1j");
  const edges = [
    edge("e0", "src", "s1"),
    main("e1", "s1", "d2"),
    edge("e2a", "d2", "a1", "Anonymous"),
    edge("e2b", "d2", "b1", "Confidential"),
    edge("e2c", "d2", "c1", "Share name"),
    main("e2", "d2", "s3"),
    edge("ea1", "a1", "j_a"),
    edge("eb1", "b1", "b2"),
    edge("eb2", "b2", "j_b"),
    edge("ec1", "c1", "j_c"),
    main("e3", "s3", "s4"),
    main("e4", "s4", "s5"),
    main("e5", "s5", "s6"),
    main("e6", "s6", "s7"),
    main("e7", "s7", "d8", ""),
    main("e8", "d8", "d9", "Yes"),
    edge("e8n", "d8", "n8", "No"),
    edge("en8", "n8", "j_n8"),
    main("e9", "d9", "s10", "Valid"),
    edge("e9n", "d9", "r9", "Invalid"),
    edge("er9", "r9", "e_bad"),
    main("e10", "s10", "d11"),
    main("e11", "d11", "s12", "Yes"),
    edge("e11a", "d11", "p11a", "Needs info"),
    edge("e11b", "d11", "p11b", "Not yet"),
    edge("e11c", "d11", "p11c", "Escalate"),
    edge("e11a0", "p11a", "d11a"),
    edge("e11a1", "d11a", "p11a1", "Replies"),
    edge("e11a2", "d11a", "p11a2", "No reply"),
    edge("ep11a1", "p11a1", "j_p11a1"),
    edge("ep11a2", "p11a2", "e_bad2"),
    edge("ep11b", "p11b", "j_p11b"),
    edge("ep11c", "p11c", "j_p11c"),
    main("e12", "s12", "s13"),
    main("e13", "s13", "d14"),
    main("e14", "d14", "e_ok", "Yes"),
    edge("e14n", "d14", "n14", "No"),
    edge("en14", "n14", "j_n14"),
  ];
  return { nodes: keep, edges };
}

/** A smaller recruitment flow (Teleperformance style): a straight main path with two exception paths and a merge. */
export function pilotLike() {
  const nodes = [
    start("src", "Qualified candidate"),
    system("t1", "Send self-scheduling link", "message"),
    person("t2", "Candidate picks a slot", "CANDIDATE", { actionType: "candidate" }),
    system("t3", "Remind 48 hours before", "message"),
    decision("t4", "Attended?"),
    system("t5", "No-show: send recovery message", "message"),
    person("t6", "Conducts the interview", "RECRUITER"),
    decision("t7", "Passed?"),
    system("t8", "Move to Hired", "move"),
    system("t9", "Move to Rejected", "move"),
    end("e1", "Hired", "success"),
    end("e2", "Rejected", "failure"),
    end("e3", "Manual follow-up", "neutral"),
  ];
  const edges = [
    edge("p0", "src", "t1"),
    main("p1", "t1", "t2"),
    main("p2", "t2", "t3"),
    main("p3", "t3", "t4"),
    main("p4", "t4", "t6", "Yes"),
    edge("p4n", "t4", "t5", "No"),
    edge("p5", "t5", "e3"),
    main("p6", "t6", "t7"),
    main("p7", "t7", "t8", "Pass"),
    edge("p7n", "t7", "t9", "Fail"),
    main("p8", "t8", "e1"),
    edge("p9", "t9", "e2"),
  ];
  return { nodes, edges };
}

export const table = (id: string, caption: string, columns: string[], rows: string[][], highlight: string[] = []) => ({
  id,
  type: "table",
  position: { x: 0, y: 0 },
  data: {
    label: caption,
    type: "table",
    columns: columns.map((c, i) => ({ id: `c${i}`, label: c })),
    rows: rows.map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, v]))),
    highlight,
  },
});
