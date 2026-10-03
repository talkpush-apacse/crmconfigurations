import test from "node:test";
import assert from "node:assert/strict";
import { layoutProcessMap } from "../src/lib/workflow/process-map/layout";
import { myPalLike, pilotLike } from "./fixtures/process-map-fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = { x: number; y: number; w: number; h: number; badge: number };

function rects(nodes: any[], res: ReturnType<typeof layoutProcessMap>): Map<string, R> {
  const m = new Map<string, R>();
  for (const n of nodes) {
    const p = res.positions.get(n.id);
    const s = res.sizes.get(n.id);
    const box = res.boxes.get(n.id);
    if (p && s) m.set(n.id, { x: p.x, y: p.y, w: s.w, h: s.h, badge: box?.badgeSpace ?? 0 });
  }
  return m;
}
const cx = (r: R) => r.x + r.w / 2;
const cy = (r: R) => r.y + r.h / 2;

for (const [name, make] of [["MyPal-style", myPalLike], ["pilot-style", pilotLike]] as const) {
  const { nodes, edges } = make();
  const res = layoutProcessMap(nodes, edges);
  const rs = rects(nodes, res);
  const flow = nodes.filter((n) => !["note", "table"].includes(n.type));

  test(`layout (${name}): every step is placed`, () => {
    for (const n of flow) assert.ok(rs.has(n.id), `${n.id} has a position`);
  });

  test(`layout (${name}): the main path is on one straight row`, () => {
    const ys = res.numbering.spineOrder.map((id) => Math.round(cy(rs.get(id)!)));
    assert.equal(new Set(ys).size, 1, `centers all at ${ys[0]}`);
  });

  test(`layout (${name}): the main path reads left to right with room between steps`, () => {
    const order = res.numbering.spineOrder.map((id) => rs.get(id)!);
    for (let i = 1; i < order.length; i++) assert.ok(order[i].x >= order[i - 1].x + order[i - 1].w + 60, `step ${i} clear of step ${i - 1}`);
  });

  test(`layout (${name}): the entry channel is on the same row as the main path`, () => {
    const row = Math.round(cy(rs.get(res.numbering.spineOrder[0])!));
    for (const n of nodes.filter((x) => x.type === "source")) assert.equal(Math.round(cy(rs.get(n.id)!)), row);
    const src = nodes.find((x) => x.type === "source")!;
    assert.ok(cx(rs.get(src.id)!) < cx(rs.get(res.numbering.spineOrder[0])!), "to the left");
  });

  test(`layout (${name}): nothing overlaps (including the icon badge above a box)`, () => {
    const list = flow.map((n) => ({ id: n.id, ...rs.get(n.id)! }));
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
        const overlapY = a.y - a.badge < b.y + b.h && b.y - b.badge < a.y + a.h;
        assert.ok(!(overlapX && overlapY), `${a.id} overlaps ${b.id}`);
      }
  });

  test(`layout (${name}): a path drops below the step it leaves, and a single path drops dead straight`, () => {
    for (const [child, parent] of res.numbering.parentOf) {
      if (res.numbering.spineOrder.includes(child)) continue;
      const c = rs.get(child);
      const p = rs.get(parent);
      if (!c || !p) continue;
      assert.ok(c.y >= p.y + p.h + 90, `${child} is at least 90px below ${parent}`);
    }
    // single-child hangs
    const kids = new Map<string, string[]>();
    for (const [child, parent] of res.numbering.parentOf) if (!res.numbering.spineOrder.includes(child)) kids.set(parent, [...(kids.get(parent) ?? []), child]);
    for (const [parent, list] of kids) {
      if (list.length !== 1) continue;
      assert.ok(Math.abs(cx(rs.get(list[0])!) - cx(rs.get(parent)!)) < 1, `${list[0]} is straight below ${parent}`);
    }
  });

  test(`layout (${name}): a fork's paths are centered under it by the middle of their first shapes`, () => {
    const kids = new Map<string, string[]>();
    for (const [child, parent] of res.numbering.parentOf) if (!res.numbering.spineOrder.includes(child)) kids.set(parent, [...(kids.get(parent) ?? []), child]);
    for (const [parent, list] of kids) {
      if (list.length < 2) continue;
      const mean = list.reduce((a, id) => a + cx(rs.get(id)!), 0) / list.length;
      assert.ok(Math.abs(mean - cx(rs.get(parent)!)) < 1, `${parent}: paths centered (${mean.toFixed(1)} vs ${cx(rs.get(parent)!).toFixed(1)})`);
    }
  });

  test(`layout (${name}): connectors use elbows and paths leaving one step share one exit`, () => {
    const exits = new Map<string, Set<string>>();
    for (const e of edges) {
      const r = res.edges.get(e.id);
      if (!r) continue;
      assert.equal(r.lineType, "step");
      const isTreeBranch = !res.numbering.spineOrder.includes(e.target) && res.numbering.enteredVia.get(e.target) === e.id;
      if (isTreeBranch) exits.set(e.source, (exits.get(e.source) ?? new Set()).add(r.sourceHandle));
    }
    for (const [src, set] of exits) assert.equal(set.size, 1, `${src} has one exit anchor for its branches`);
  });
}

test("layout (MyPal-style): the first fork's paths run left to right in numbering order", () => {
  const { nodes, edges } = myPalLike();
  const res = layoutProcessMap(nodes, edges);
  const rs = rects(nodes, res);
  assert.ok(cx(rs.get("a1")!) < cx(rs.get("b1")!) && cx(rs.get("b1")!) < cx(rs.get("c1")!));
  assert.equal(res.numbering.stepNumbers.get("a1"), "2.1");
});

test("layout (MyPal-style): a nested fork's paths sit side by side below it, centered", () => {
  const { nodes, edges } = myPalLike();
  const res = layoutProcessMap(nodes, edges);
  const rs = rects(nodes, res);
  const a = rs.get("p11a1")!;
  const b = rs.get("p11a2")!;
  assert.ok(a.x + a.w < b.x, "side by side");
  assert.ok(Math.abs((cx(a) + cx(b)) / 2 - cx(rs.get("d11a")!)) < 1);
});

test("layout: joins leave sideways and enter the target from below; main-path connectors go right to left handle", () => {
  const { nodes, edges } = pilotLike();
  const res = layoutProcessMap(nodes, edges);
  const spineEdge = res.edges.get("p2")!;
  assert.deepEqual([spineEdge.sourceHandle, spineEdge.targetHandle], ["right", "left"]);
  const drop = res.edges.get("p4n")!;
  assert.deepEqual([drop.sourceHandle, drop.targetHandle], ["bottom", "top"]);
});

test("layout is deterministic: running it twice gives identical positions", () => {
  const { nodes, edges } = myPalLike();
  const a = layoutProcessMap(nodes, edges);
  const b = layoutProcessMap(nodes, edges);
  assert.deepEqual([...a.positions.entries()], [...b.positions.entries()]);
});
