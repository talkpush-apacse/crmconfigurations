import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { rejectUnlessCron } from "../src/lib/cron-auth";

// The cron routes call rejectUnlessCron() before touching the database or
// sending any email, so a non-null result here means the sweep never runs.
// This test imports only the pure helper — no DB, no server-only modules.

function req(authorization?: string): Request {
  return new Request("http://localhost/api/cron/notifications", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("rejectUnlessCron", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-value";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("rejects a request with no authorization header", () => {
    assert.equal(rejectUnlessCron(req())?.status, 401);
  });

  it("rejects a wrong secret", () => {
    assert.equal(rejectUnlessCron(req("Bearer nope"))?.status, 401);
  });

  it("rejects a secret without the Bearer prefix", () => {
    assert.equal(rejectUnlessCron(req("s3cret-value"))?.status, 401);
  });

  it('rejects "Bearer undefined" when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    assert.equal(rejectUnlessCron(req("Bearer undefined"))?.status, 401);
  });

  it("rejects everything when CRON_SECRET is an empty string", () => {
    process.env.CRON_SECRET = "";
    assert.equal(rejectUnlessCron(req("Bearer "))?.status, 401);
    assert.equal(rejectUnlessCron(req())?.status, 401);
  });

  it("lets the correct secret through", () => {
    assert.equal(rejectUnlessCron(req("Bearer s3cret-value")), null);
  });
});
