import { nameKey, suggestAccount, type NamedAccount } from "./names";

/**
 * The "needs a company" holding area. Checklists and workflows that are not filed under a company yet are grouped by the
 * client name typed on them, so six workflows for the same client can be filed in one go. Pure: no database access.
 */

export interface UnassignedChecklist {
  id: string;
  clientName: string;
  slug: string;
  updatedAt: string;
}

export interface UnassignedWorkflow {
  id: string;
  clientName: string;
  workflowName: string;
  status: string;
  updatedAt: string;
}

export interface UnassignedGroup {
  /** Stable id for the group: the normalised client name. */
  key: string;
  /** The way staff most often typed it. */
  clientName: string;
  /** A company whose name matches, offered as a suggestion only. */
  suggestion: NamedAccount | null;
  checklists: UnassignedChecklist[];
  workflows: UnassignedWorkflow[];
}

export function groupUnassigned(checklists: UnassignedChecklist[], workflows: UnassignedWorkflow[], accounts: NamedAccount[]): UnassignedGroup[] {
  const groups = new Map<string, UnassignedGroup & { spellings: Map<string, number> }>();
  const slot = (clientName: string) => {
    const key = nameKey(clientName) || clientName.trim().toLowerCase() || "(no name)";
    let g = groups.get(key);
    if (!g) {
      g = { key, clientName, suggestion: null, checklists: [], workflows: [], spellings: new Map() };
      groups.set(key, g);
    }
    g.spellings.set(clientName, (g.spellings.get(clientName) ?? 0) + 1);
    return g;
  };
  for (const c of checklists) slot(c.clientName).checklists.push(c);
  for (const w of workflows) slot(w.clientName).workflows.push(w);

  return [...groups.values()]
    .map(({ spellings, ...g }) => {
      const best = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? g.clientName;
      return { ...g, clientName: best, suggestion: suggestAccount(best, accounts) };
    })
    .sort((a, b) => b.checklists.length + b.workflows.length - (a.checklists.length + a.workflows.length) || a.clientName.localeCompare(b.clientName));
}

export function unassignedTotal(groups: UnassignedGroup[]): number {
  return groups.reduce((n, g) => n + g.checklists.length + g.workflows.length, 0);
}
