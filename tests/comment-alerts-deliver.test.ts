import test from "node:test";
import assert from "node:assert/strict";

const event = { kind: "workflow" as const, workflowId: "w1", authorName: "Maria Cruz", body: "Hello there", isReply: false };
const place = { placeName: "Hiring flow", companyName: "Concentrix PH", itemTitle: null, path: "/admin/workflows/w1" };
const NOW = new Date("2026-10-09T06:30:00Z");

async function run(over: Record<string, unknown> = {}) {
  const { deliverCommentAlert } = await import("../src/lib/comment-alerts/orchestrate");
  const sent: { to: string; subject: string; html: string; text: string }[] = [];
  const deps = {
    recipient: async () => "jolo.yu@talkpush.com" as string | null,
    loadPlace: async () => place as typeof place | null,
    baseUrl: () => "https://crmconfig.talkpush.com",
    send: async (m: { to: string; subject: string; html: string; text: string }) => {
      sent.push(m);
      return { ok: true };
    },
    now: () => NOW,
    ...over,
  };
  const result = await deliverCommentAlert(event, deps);
  return { result, sent };
}

test("sends one email to the recipient with a link to the staff page", async () => {
  const { result, sent } = await run();
  assert.equal(result, "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "jolo.yu@talkpush.com");
  assert.match(sent[0].html, /https:\/\/crmconfig\.talkpush\.com\/admin\/workflows\/w1/);
});

test("sends nothing when there is no valid super admin recipient", async () => {
  const { result, sent } = await run({ recipient: async () => null });
  assert.equal(result, "no-recipient");
  assert.equal(sent.length, 0);
});

test("sends nothing when the workflow or item no longer exists, or the Hub address is unknown", async () => {
  assert.equal((await run({ loadPlace: async () => null })).result, "no-place");
  const noBase = await run({ baseUrl: () => "" });
  assert.equal(noBase.result, "no-base-url");
  assert.equal(noBase.sent.length, 0);
});

test("a failed send is reported as failed, not thrown", async () => {
  const { result } = await run({ send: async () => ({ ok: false, error: "Brevo down" }) });
  assert.equal(result, "failed");
});
