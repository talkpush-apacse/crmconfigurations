import test from "node:test";
import assert from "node:assert/strict";
import { planConnectHandoff, planGoogleSignIn, signInOrigin } from "../src/lib/google-sign-in";

const REDIRECT = "https://crmconfig.talkpush.com/api/auth/google/callback";

test("starting on the address Google returns to just continues", () => {
  assert.deepEqual(planGoogleSignIn("https://crmconfig.talkpush.com/api/auth/google", REDIRECT), { action: "continue" });
  assert.deepEqual(planGoogleSignIn("https://CRMCONFIG.talkpush.com/api/auth/google", REDIRECT), { action: "continue" });
});

test("starting on the site's other address moves the person to the one Google returns to", () => {
  const plan = planGoogleSignIn("https://crm.se-talkpush.com/api/auth/google", REDIRECT);
  assert.deepEqual(plan, { action: "move", url: "https://crmconfig.talkpush.com/api/auth/google" });
});

test("the place people are moved to comes only from the server setting, never from the request", () => {
  for (const evil of [
    "https://crm.se-talkpush.com/api/auth/google?next=https://evil.example",
    "https://crm.se-talkpush.com/api/auth/google#https://evil.example",
    "https://crm.se-talkpush.com/api/auth/google/../../x",
  ]) {
    const plan = planGoogleSignIn(evil, REDIRECT);
    assert.equal(plan.action, "move");
    assert.equal(plan.action === "move" && plan.url, "https://crmconfig.talkpush.com/api/auth/google");
  }
});

test("a preview or a local copy says Google sign-in is unavailable instead of failing later", () => {
  assert.deepEqual(planGoogleSignIn("https://crmconfigurations-git-feat-rea-dc4eb7-talkpush-apacses-projects.vercel.app/api/auth/google", REDIRECT), { action: "unavailable" });
  assert.deepEqual(planGoogleSignIn("http://localhost:3000/api/auth/google", REDIRECT), { action: "unavailable" });
  assert.deepEqual(planGoogleSignIn("http://127.0.0.1:3000/api/auth/google", REDIRECT), { action: "unavailable" });
});

test("a local copy set up to return to itself still works", () => {
  assert.deepEqual(planGoogleSignIn("http://localhost:3000/api/auth/google", "http://localhost:3000/api/auth/google/callback"), { action: "continue" });
});

test("with no setting, or an unreadable one, behaviour is unchanged", () => {
  assert.deepEqual(planGoogleSignIn("https://crm.se-talkpush.com/api/auth/google", undefined), { action: "continue" });
  assert.deepEqual(planGoogleSignIn("https://crm.se-talkpush.com/api/auth/google", ""), { action: "continue" });
  assert.deepEqual(planGoogleSignIn("https://crm.se-talkpush.com/api/auth/google", "not a url"), { action: "continue" });
});

test("the sign-in address shown to editors is where Google returns to", () => {
  assert.equal(signInOrigin(REDIRECT, "https://other.example"), "https://crmconfig.talkpush.com");
  assert.equal(signInOrigin(undefined, "https://other.example"), "https://other.example");
  assert.equal(signInOrigin("garbage", "https://other.example"), "https://other.example");
});

const AUTHORIZE = "/oauth/authorize?response_type=code&client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&state=a%2Fb&code_challenge=x";

test("connect: started on the site's other address, the whole request moves to the Google address", () => {
  assert.deepEqual(planConnectHandoff(`https://crm.se-talkpush.com${AUTHORIZE}`, REDIRECT), {
    action: "move",
    url: `https://crmconfig.talkpush.com${AUTHORIZE}`,
  });
});

test("connect: already on the Google address, a preview, local, or no setting just continues", () => {
  assert.deepEqual(planConnectHandoff(`https://crmconfig.talkpush.com${AUTHORIZE}`, REDIRECT), { action: "continue" });
  assert.deepEqual(planConnectHandoff(`https://crmconfigurations-git-x-y.vercel.app${AUTHORIZE}`, REDIRECT), { action: "continue" });
  assert.deepEqual(planConnectHandoff(`http://localhost:3000${AUTHORIZE}`, REDIRECT), { action: "continue" });
  assert.deepEqual(planConnectHandoff(`https://crm.se-talkpush.com${AUTHORIZE}`, undefined), { action: "continue" });
  assert.deepEqual(planConnectHandoff(`https://crm.se-talkpush.com${AUTHORIZE}`, "not a url"), { action: "continue" });
});

test("connect: the place it moves to comes only from the server setting", () => {
  for (const evil of ["https://crm.se-talkpush.com//evil.example/x", "https://crm.se-talkpush.com/oauth/authorize?next=https://evil.example"]) {
    const plan = planConnectHandoff(evil, REDIRECT);
    assert.equal(plan.action, "move");
    if (plan.action === "move") assert.equal(new URL(plan.url).origin, "https://crmconfig.talkpush.com");
  }
});
