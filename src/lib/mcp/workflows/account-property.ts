/**
 * The optional "account" input every workflow-creating tool takes: the account the workflow is filed under. An account is
 * a company in one geo ("Concentrix PH"). It is a name or an id of a Project Tracker account (list_accounts shows them;
 * create_account makes a new one from a company and a geo).
 */
export const accountProperty = {
  type: "string",
  description:
    "The account this workflow belongs to: a company in one geo, for example \"Concentrix PH\". Give its name (matched exactly, ignoring capitals) or its id. Use list_accounts to see the accounts. If the account is not there, ask the person whether to create it first with create_account (a company and a geo). Leave this out only when the account is not known yet: the workflow then waits under \"Needs an account\" in the app. A wrong, unclear or archived account stops the tool with a message that says why, and nothing is created.",
} as const;
