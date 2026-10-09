import test from "node:test";
import assert from "node:assert/strict";
import { cronAuthorised } from "../src/lib/activity-digest/cron-auth";

const SECRET = "a-long-random-cron-secret-0123456789";

test("the right secret in the right header is accepted", () => {
  assert.equal(cronAuthorised(`Bearer ${SECRET}`, SECRET), true);
});

test("with no secret configured, everything is refused, including the text 'Bearer undefined'", () => {
  for (const secret of [undefined, null, ""]) {
    for (const header of ["Bearer undefined", "Bearer null", "Bearer ", "Bearer", "", null, undefined]) {
      assert.equal(cronAuthorised(header, secret), false, `secret=${String(secret)} header=${String(header)}`);
    }
  }
});

test("a wrong, partial, longer, differently-cased or missing header is refused", () => {
  for (const header of [`Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, `bearer ${SECRET}`, `Basic ${SECRET}`, SECRET, "", null, undefined, `Bearer  ${SECRET}`]) {
    assert.equal(cronAuthorised(header, SECRET), false, String(header));
  }
});
