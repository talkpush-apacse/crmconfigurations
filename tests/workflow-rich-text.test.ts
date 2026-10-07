import test from "node:test";
import assert from "node:assert/strict";
import { parseRich, serializeRich, stripRich, wrapRich } from "../src/lib/workflow/rich-text";
import { wrapText } from "../src/lib/workflow/process-map/text-fit";

test("rich text: bold, italic and underline parse into styled runs", () => {
  assert.deepEqual(parseRich("a **b** *c* __d__ e"), [
    { text: "a " },
    { text: "b", bold: true },
    { text: " " },
    { text: "c", italic: true },
    { text: " " },
    { text: "d", underline: true },
    { text: " e" },
  ]);
  assert.deepEqual(parseRich("**bold *and italic* too**"), [{ text: "bold ", bold: true }, { text: "and italic", bold: true, italic: true }, { text: " too", bold: true }]);
});

test("rich text: stars and underscores that are not real markers stay as typed", () => {
  for (const s of ["5 * 3 * 2", "* a bullet", "Required*", "snake_case_name", "__init__ works?", "unclosed **bold", "a ** b ** c"]) {
    const plain = stripRich(s);
    if (s === "__init__ works?") assert.equal(plain, "init works?"); // a real underline pair
    else assert.equal(plain, s, s);
  }
  assert.equal(stripRich("Plain note with no markers."), "Plain note with no markers.");
  assert.equal(stripRich(null), "");
});

test("rich text: backslash types a marker character literally", () => {
  assert.equal(stripRich("a \\*b\\* c"), "a *b* c");
  assert.deepEqual(parseRich("\\*not italic\\*"), [{ text: "*not italic*" }]);
});

test("rich text: serialize reads back as the same runs, including edge spaces and overlaps", () => {
  const cases = [
    [{ text: "Hello " }, { text: "world", bold: true }, { text: "!" }],
    [{ text: "bold ", bold: true }, { text: "both", bold: true, italic: true }, { text: " ital", italic: true }],
    [{ text: "x * y ** z __ w" }, { text: " lit", underline: true }],
    [{ text: "line one\nline two", italic: true }],
    [{ text: "ab", italic: true }, { text: "cd", bold: true }, { text: "ef", bold: true, italic: true }, { text: "gh", underline: true }],
    [{ text: "all three", bold: true, italic: true, underline: true }, { text: "x", italic: true }],
  ];
  for (const segs of cases) {
    const stored = serializeRich(segs);
    // Edge spaces inside styled runs move outside the markers, so compare what readers see.
    const back = parseRich(stored);
    assert.equal(back.map((s) => s.text).join(""), segs.map((s) => s.text).join(""), stored);
    const styleAt = (list: any[], i: number) => {
      let n = 0;
      for (const s of list) {
        if (i < n + s.text.length) return `${!!s.bold}${!!s.italic}${!!s.underline}`;
        n += s.text.length;
      }
    };
    const total = segs.map((s) => s.text).join("");
    for (let i = 0; i < total.length; i++) {
      if (/\s/.test(total[i])) continue;
      assert.equal(styleAt(back, i), styleAt(segs, i), `${stored} @${i}`);
    }
  }
});

test("rich text: wrapping plain notes gives exactly the lines the old wrapper did", () => {
  const samples = ["", "short", "a long note that needs to wrap across several lines of the box", "para one\n\npara two", "supercalifragilisticexpialidocious_and_more_letters_here"];
  for (const t of samples) {
    for (const max of [8, 20, 34]) {
      const old = wrapText(t, max);
      const now = wrapRich(t, max).map((runs) => runs.map((r) => r.text).join(""));
      assert.deepEqual(now, old, `${JSON.stringify(t)} @${max}`);
    }
  }
});

test("rich text: wrapped lines keep their styles across line breaks", () => {
  const lines = wrapRich("start **bold words that wrap** end", 12);
  const flat = lines.flat();
  assert.equal(flat.filter((r) => r.bold).map((r) => r.text).join("|"), "bold|words that|wrap");
  assert.ok(lines.every((l) => l.map((r) => r.text).join("").length <= 12));
});
