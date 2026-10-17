import test from "node:test";
import assert from "node:assert/strict";
import { duplicateChecklist } from "../src/lib/checklist-admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Call = { url: string; method: string; body: any };

/** Runs duplicateChecklist against a pretend server. `taken` are the names that already exist (the server answers 409 for them). */
async function run(taken: string[], source: Record<string, unknown>) {
  const calls: Call[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (method === "GET") return json(source);
    if (method === "POST") {
      if (taken.includes(body.clientName)) return json({ error: "A checklist with this name already exists" }, 409);
      return json({ id: "new-id", slug: String(body.clientName).toLowerCase().replace(/[^a-z0-9]+/g, "-"), version: 0 }, 201);
    }
    return json({ id: "new-id", version: 1 });
  }) as typeof fetch;
  try {
    const copy = await duplicateChecklist("src-id");
    return { copy, calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const SOURCE = { clientName: "Acme", ownerEmail: null, isCustom: false, enabledTabs: ["sites"], integrations: [{ name: "ATS" }], autoflows: { sets: [1] }, users: [{ name: "A" }] };

test("duplicate checklist: named '(Copy)', and carries integrations and autoflows across", async () => {
  const { copy, calls } = await run([], SOURCE);
  assert.equal(copy.name, "Acme (Copy)");
  const put = calls.find((c) => c.method === "PUT")!;
  assert.deepEqual(put.body.integrations, SOURCE.integrations);
  assert.deepEqual(put.body.autoflows, SOURCE.autoflows);
  assert.deepEqual(put.body.users, SOURCE.users);
});

test("duplicate checklist: a second copy is '(Copy 2)', a third '(Copy 3)', instead of failing", async () => {
  assert.equal((await run(["Acme (Copy)"], SOURCE)).copy.name, "Acme (Copy 2)");
  assert.equal((await run(["Acme (Copy)", "Acme (Copy 2)"], SOURCE)).copy.name, "Acme (Copy 3)");
});

test("duplicate checklist: gives up with the server's message if every name is taken", async () => {
  const taken = ["Acme (Copy)", ...Array.from({ length: 30 }, (_, i) => `Acme (Copy ${i + 2})`)];
  await assert.rejects(() => run(taken, SOURCE), /already exists/);
});
