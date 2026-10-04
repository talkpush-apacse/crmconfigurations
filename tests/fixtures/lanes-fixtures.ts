import { decision, edge, end, note, person, start, system } from "./process-map-fixtures";

/**
 * The integration process from the lanes mock-up, as real steps: an assessment platform and an HRIS as outside
 * systems, four stages, a rejection path, an offer that can be declined, and a failed sync to the HRIS.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const at = (n: any, lane: string, stage?: string, external = false) => ({
  ...n,
  data: { ...n.data, lane, ...(stage ? { stage } : {}), ...(external ? { laneKind: "external" } : {}) },
});
const att = (n: any, to: string) => ({ ...n, data: { ...n.data, attachTo: to } });
const cand = (id: string, label: string) => person(id, label, "CANDIDATE", { actor: "candidate", actionType: "candidate" });
const main = (id: string, s: string, t: string, label = "") => edge(id, s, t, label, { isPrimary: true, isHappyPath: true });

const T = "Talkpush automation";
const S1 = "1. Apply and screen";
const S2 = "2. Assessment";
const S3 = "3. Interview and offer";
const S4 = "4. Hire";

export function integrationMap() {
  const nodes = [
    at(start("e", "Facebook ad or careers page"), "Candidate", S1),
    at(cand("s1", "Applies"), "Candidate", S1),
    at(system("s2", "Chatbot prescreening", "system"), T, S1),
    at(decision("d3", "All 4 answers pass?"), T),
    at(system("r1", "Sends rejection notice", "message", { timing: "1 hour after", data: { channel: "email" } }), T),
    at(system("r2", "Candidate marked as Rejected", "move"), T),
    at(end("r3", "Rejected: did not pass prescreening", "failure"), T),
    at(system("s4", "Sends assessment invite", "message", { timing: "immediately", data: { channel: "email + sms" } }), T),
    at(system("s5", "Sends candidate details to the assessment platform", "send_data"), T, S2),
    at(cand("s6", "Takes the online assessment"), "Candidate"),
    at(system("s7", "Scores the assessment", "system"), "Assessment platform", undefined, true),
    at(system("s8", "Receives the score", "get_data"), T),
    at(decision("d9", "Score meets the bar?"), T),
    at(system("t1", "Sends result notice", "message", { timing: "1 day after", data: { channel: "email" } }), T),
    at(system("t2", "Candidate marked as Rejected", "move"), T),
    at(end("t3", "Rejected: assessment score below the bar", "failure"), T),
    at(person("s10", "Interviews the candidate", "RECRUITER"), "Recruiter", S3),
    at(decision("d11", "Interview passed?", { actor: "manual", actorLabel: "RECRUITER" }), "Recruiter"),
    at(person("s12", "Sends the job offer", "RECRUITER"), "Recruiter"),
    at(decision("d13", "Accepts the offer?"), "Candidate"),
    at(system("c1", "Candidate marked as Closed", "move"), T),
    at(end("c2", "Closed: offer declined", "neutral"), T),
    at(system("s14", "Sends new-hire details to the HRIS", "send_data"), T, S4),
    at(system("s15", "Creates the employee record", "system"), "HRIS", undefined, true),
    at(system("s16", "Receives the employee ID", "get_data"), T),
    at(system("s17", "Candidate marked as Hired", "move"), T),
    at(system("s18", "Notifies the hiring manager", "alert", { timing: "immediately", data: { channel: "email" } }), T),
    at(end("e2", "Hired: offer accepted", "success"), T),
    at(system("f1", "Notifies the recruiter to fix the record", "alert", { timing: "immediately", data: { channel: "email" } }), "Recruiter"),
    at(end("f2", "Handed off: recruiter fixes the record", "neutral"), "Recruiter"),
    att(note("q1", "Prescreening questions", "1. Age 18+\n2. Can work weekends\n3. Lives within 20 km of a store\n4. Has a valid ID"), "s2"),
    att(note("q2", "Details sent", "Name, email, phone, role applied for"), "s5"),
    att(note("q3", "To confirm with Sample Retail Co", "What score passes?", "needs_input"), "d9"),
    att(note("q5", "To confirm with Sample Retail Co", "What happens if the interview is not passed?", "needs_input"), "d11"),
  ];
  const edges = [
    edge("a", "e", "s1"),
    main("m1", "s1", "s2"), main("m2", "s2", "d3"), main("m3", "d3", "s4", "Yes"), edge("b1", "d3", "r1", "No"), edge("b2", "r1", "r2"), edge("b3", "r2", "r3"),
    main("m4", "s4", "s5"), main("m5", "s5", "s6"), main("m6", "s6", "s7"), main("m7", "s7", "s8"), main("m8", "s8", "d9"),
    main("m9", "d9", "s10", "Yes"), edge("b4", "d9", "t1", "No"), edge("b5", "t1", "t2"), edge("b6", "t2", "t3"),
    main("m10", "s10", "d11"), main("m11", "d11", "s12", "Pass"), edge("fail", "d11", "q5", "Fail"),
    main("m12", "s12", "d13"), main("m13", "d13", "s14", "Yes"), edge("b7", "d13", "c1", "No"), edge("b8", "c1", "c2"),
    main("m14", "s14", "s15"), main("m15", "s15", "s16"), main("m16", "s16", "s17"), main("m17", "s17", "s18"), main("m18", "s18", "e2"),
    edge("b9", "s15", "f1", "Sync fails"), edge("b10", "f1", "f2"),
  ];
  return { nodes, edges };
}

/** Three actors, no stages: one untitled band with three lanes. */
export function threeActorMap() {
  const nodes = [
    at(start("s", "Application received"), "Candidate"),
    at(cand("a", "Submits documents"), "Candidate"),
    at(person("b", "Checks the documents", "HR"), "HR"),
    at(system("c", "Sends the result", "message", { timing: "immediately", data: { channel: "email" } }), "Talkpush"),
    at(end("e", "Done", "success"), "Talkpush"),
  ];
  const edges = [edge("e1", "s", "a"), edge("e2", "a", "b"), edge("e3", "b", "c"), edge("e4", "c", "e")];
  return { nodes, edges };
}
