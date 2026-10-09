/**
 * What an unauthenticated visitor may be handed from a checklist row. The client link (by slug) and the editor
 * link (by token) each see a different slice, and both the API routes and the server-rendered pages must use
 * these exact functions so the two paths can never drift apart.
 *
 * Deny-listing on a full row (rather than a hand-typed `select` allow-list) means a new checklist field is public
 * by default and has to be deliberately excluded here. The allow-list this replaced had already drifted: `labels`
 * was missing because it did not exist when the list was written. When adding a column to Checklist, decide here
 * whether visitors may see it. Audit every column on the model, not just the JSON ones.
 *
 * Pure functions, no database access, so they are unit-tested (tests/checklist-public.test.ts).
 */

/** Client link (/client/<slug>): the slice a client sees. */
export function omitInternalConfigForSlug<T extends Record<string, unknown>>(checklist: T) {
  const publicChecklist = { ...checklist };
  delete publicChecklist.atsIntegrations;
  delete publicChecklist.integrations;
  delete publicChecklist.configuratorChecklist;
  // editorToken must never be returned to slug-based public viewers.
  delete publicChecklist.editorToken;
  // The read-only view link is a secret too: only staff are shown it.
  delete publicChecklist.viewToken;
  // Internal telephony/SMS operational config, not shown to clients.
  delete publicChecklist.adminSettings;
  // Optimistic-concurrency bookkeeping: internal, not part of any tab's UI.
  delete publicChecklist.fieldVersions;
  // A real person's email address: must never go out on an unauthenticated, slug-based public link.
  delete publicChecklist.ownerEmail;
  // Per-tab edit/notify timestamps for the owner-email feature: internal bookkeeping.
  delete publicChecklist.notificationState;
  // Which internal company record this belongs to: staff bookkeeping, never for a client or editor link.
  delete publicChecklist.accountId;
  // Named edit links (secret link text) and the edit history: staff only.
  delete publicChecklist.editLinks;
  delete publicChecklist.editEvents;
  return publicChecklist;
}

/** Editor link (/editor/<token>): the token holder is trusted with a little more than a client (e.g. adminSettings). */
export function omitInternalConfigForToken<T extends Record<string, unknown>>(checklist: T) {
  const publicChecklist = { ...checklist };
  delete publicChecklist.atsIntegrations;
  delete publicChecklist.integrations;
  delete publicChecklist.configuratorChecklist;
  // editorToken is already known to the caller; don't echo it back.
  delete publicChecklist.editorToken;
  // The view link is a different secret from the editor link: an editor must not learn it.
  delete publicChecklist.viewToken;
  // A real person's email address. The editor UI never renders it, and a bare link needs no other auth.
  delete publicChecklist.ownerEmail;
  // Per-tab edit/notify timestamps for the owner-email feature: internal bookkeeping.
  delete publicChecklist.notificationState;
  // Which internal company record this belongs to: staff bookkeeping, never for a client or editor link.
  delete publicChecklist.accountId;
  // Named edit links (secret link text) and the edit history: staff only.
  delete publicChecklist.editLinks;
  delete publicChecklist.editEvents;
  return publicChecklist;
}

/**
 * View link (/view/<token>): read only, and shown the same slice a client sees. Anyone holding the link can read
 * it, so it gets the narrower (client) slice, not the editor slice with the telephony/SMS settings.
 */
export function omitInternalConfigForView<T extends Record<string, unknown>>(checklist: T) {
  const publicChecklist = omitInternalConfigForSlug(checklist);
  // Never echo the secret back, and no hidden field of the editor slice sneaks in.
  delete publicChecklist.viewToken;
  delete publicChecklist.editorToken;
  return publicChecklist;
}
