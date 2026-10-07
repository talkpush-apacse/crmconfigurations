/**
 * Which account did Claude mean? A create tool can be told "account": an account's name ("Concentrix PH") or its id. Filing a
 * workflow under the wrong account is quietly confusing, so the rule is strict: an id, or a name that matches ONE account exactly
 * (ignoring capitals and extra spaces). A near miss is never accepted; it is offered back as "did you mean". Pure: no
 * database access, so it is tested on its own (tests/company-ref.test.ts).
 */

export interface AccountRow {
  id: string;
  name: string;
  archived?: boolean;
}

export type AccountRefResult =
  | { kind: "one"; account: AccountRow }
  | { kind: "none"; close: AccountRow[] }
  | { kind: "many"; candidates: AccountRow[] }
  | { kind: "archived"; account: AccountRow };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function matchAccountRef(accounts: AccountRow[], ref: string): AccountRefResult {
  const q = norm(ref);
  if (!q) return { kind: "none", close: [] };

  const byId = accounts.find((c) => c.id === ref.trim());
  if (byId) return byId.archived ? { kind: "archived", account: byId } : { kind: "one", account: byId };

  const exact = accounts.filter((c) => norm(c.name) === q);
  const live = exact.filter((c) => !c.archived);
  if (live.length === 1) return { kind: "one", account: live[0] };
  if (live.length > 1) return { kind: "many", candidates: live };
  if (exact.length > 0) return { kind: "archived", account: exact[0] };

  const close = accounts.filter((c) => !c.archived && (norm(c.name).includes(q) || q.includes(norm(c.name)))).slice(0, 5);
  return { kind: "none", close };
}

/** The sentence Claude reads when the account could not be settled, so it can ask the person instead of guessing. */
export function describeAccountProblem(ref: string, result: Exclude<AccountRefResult, { kind: "one" }>): string {
  const label = (c: AccountRow) => `${c.name} (${c.id})`;
  if (result.kind === "archived") {
    return `${result.account.name} is archived, so nothing can be filed under it. Ask the person whether to restore it, or leave account out.`;
  }
  if (result.kind === "many") {
    return `More than one account is called "${ref}": ${result.candidates.map(label).join("; ")}. Pass the id of the right one.`;
  }
  const close = result.close.length ? ` Did you mean: ${result.close.map(label).join("; ")}?` : "";
  return `No account is called "${ref}".${close} Use list_accounts to see the accounts, or ask the person whether to create it first with create_account (a company and a geo). To file it later instead, leave account out: it will wait under "Needs an account".`;
}
