/**
 * CRM Config Checklist tool for starting a client's checklist. It does what the website's "Create New Checklist" form does,
 * through the same function (src/lib/checklists/create-checklist.ts), so the website and Claude cannot disagree. It never
 * fills in configurator items, never makes a client link and never sends anything: the new checklist is private.
 */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { prisma } from "@/lib/db";
import { describeAccountProblem, matchAccountRef } from "@/lib/accounts/account-ref";
import { MAX_SLUG_LENGTH, createChecklist, newChecklistFormDefaults, slugFromName, slugProblem } from "@/lib/checklists/create-checklist";
import { ChecklistToolError } from "@/lib/mcp/checklist-share-tools";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The account a checklist was told to be filed under: a name or id, or nothing. Same rules and same wording as
 * create_from_template. A name that is wrong, ambiguous or archived stops the tool before anything is created.
 */
async function resolveAccount(ref: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!ref || !ref.trim()) return null;
  const accounts = await prisma.trackerAccount.findMany({ select: { id: true, name: true, archived: true } });
  const found = matchAccountRef(accounts, ref);
  if (found.kind !== "one") throw new ChecklistToolError(describeAccountProblem(ref, found));
  return { id: found.account.id, name: found.account.name };
}

export const createChecklistTool = defineTool({
  name: "create_checklist",
  description:
    "Create a new, empty CRM Config Checklist for a client: the same as 'Create New Checklist' on the website (every standard tab on to start with, default settings, no answers filled in). To show only some tabs, use update_checklist_tabs afterwards. " +
    "Give client_name. Optionally give account (the account to file it under, by name or id; use list_accounts) and slug (the checklist's web address name; without it, it is client_name in lowercase with hyphens, so 'TaskUs PH' becomes 'taskus-ph'). " +
    "Safe to repeat: if a checklist with that slug already exists, it is returned as already_existed and nothing is created or changed (its client name and account stay as they are, and a warning says if they differ from what you passed). " +
    "If the slug belongs to an ARCHIVED checklist the tool stops with a message and does not restore it. A wrong, unclear or archived account stops the tool and nothing is created. A slug that is not lowercase letters, numbers and single hyphens is refused with the reason. " +
    "It does NOT generate the configurator items (use generate_configurator_checklist for that), does NOT create any client link (view or edit; use create_checklist_link only when the user asks) and sends nothing to anyone: the checklist starts private. " +
    "Leave account out only when the account is not known yet; the checklist then waits under 'needs a company' in the app.",
  access: "write",
  input: {
    client_name: z.string().describe("The client's name as it should show on the checklist, for example 'TaskUs PH'"),
    account: z
      .string()
      .optional()
      .describe("The account to file the checklist under: its name (matched exactly, ignoring capitals) or its id. Use list_accounts. Leave out if not known yet."),
    slug: z
      .string()
      .optional()
      .describe(`The checklist's web address name: lowercase letters, numbers and single hyphens, up to ${MAX_SLUG_LENGTH} characters (for example 'taskus-ph'). Leave out to build it from client_name.`),
  },
  handler: async ({ client_name, account, slug }) => {
    const clientName = client_name.trim();
    if (!clientName) throw new ChecklistToolError("client_name is empty. Give the client's name, for example 'TaskUs PH'.");

    // 1. The web address.
    let wanted: string;
    if (slug !== undefined && slug.trim() !== "") {
      wanted = slug.trim();
      const problem = slugProblem(wanted);
      if (problem) throw new ChecklistToolError(problem);
    } else {
      wanted = slugFromName(clientName);
      if (!wanted) {
        throw new ChecklistToolError(`"${clientName}" has no letters or numbers to build a web address from. Give a slug, for example 'taskus-ph'.`);
      }
      const problem = slugProblem(wanted);
      if (problem) throw new ChecklistToolError(`The web address built from "${clientName}" does not work. ${problem} Pass a shorter slug.`);
    }

    // 2. The account, before anything else is looked at or made.
    const requested = await resolveAccount(account);

    // 3. Is there already a checklist at this address?
    const existing = await findBySlug(wanted);
    if (existing) {
      if (existing.archivedAt) {
        throw new ChecklistToolError(
          `A checklist with the slug "${wanted}" exists but is archived ("${existing.clientName}"), so nothing was created and it was not restored. ` +
            "Ask the person whether to restore it from the checklist menu on the website (Archived checklists, Restore), or pass a different slug."
        );
      }
      const warnings: string[] = [];
      if (norm(existing.clientName) !== norm(clientName)) {
        warnings.push(`The existing checklist is called "${existing.clientName}", not "${clientName}". Its name was not changed.`);
      }
      if (requested && existing.account?.id !== requested.id) {
        warnings.push(
          existing.account
            ? `It is filed under "${existing.account.name}", not "${requested.name}". Nothing was changed.`
            : `It is not filed under any account yet, not "${requested.name}". Nothing was changed.`
        );
      }
      return shape("already_existed", existing, warnings);
    }

    // 4. Make it, the same way the website does.
    const defaults = newChecklistFormDefaults();
    const result = await createChecklist({ clientName, slug: wanted, accountId: requested?.id, ...defaults });
    if (!result.ok) {
      if (result.status === 409) {
        // Someone made it a moment ago: report what is there rather than failing.
        const now = await findBySlug(wanted);
        if (now && !now.archivedAt) return shape("already_existed", now, []);
      }
      throw new ChecklistToolError(result.error);
    }
    const made = await findBySlug(wanted);
    if (!made) throw new ChecklistToolError("The checklist was created but could not be read back. Check list_checklists.");
    return shape("created", made, []);
  },
});

async function findBySlug(slug: string) {
  return prisma.checklist.findUnique({
    where: { slug },
    select: { slug: true, clientName: true, archivedAt: true, account: { select: { id: true, name: true } } },
  });
}

type Found = NonNullable<Awaited<ReturnType<typeof findBySlug>>>;

function shape(result: "created" | "already_existed", row: Found, warnings: string[]) {
  return {
    result,
    slug: row.slug,
    clientName: row.clientName,
    account: row.account ? { id: row.account.id, name: row.account.name } : null,
    ...(warnings.length ? { warnings } : {}),
    note:
      result === "created"
        ? "Created empty and private: no configurator items, no client link, nothing sent. Next, if asked: update_checklist_tabs (to show only some tabs), generate_configurator_checklist, add_custom_tab, or create_checklist_link."
        : "Already there, so nothing was created or changed.",
  };
}

export const checklistCreateTools = [createChecklistTool];
