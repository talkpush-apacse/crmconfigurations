import type { ClientPagePayload } from "@/lib/workflow/access/client-payload";
import type { WorkflowOp } from "@/lib/workflow/ops";

/**
 * The client page's talk to the server. `base` is `/api/w/<secret link>` for a real visitor, or
 * `/api/workflows/<id>/preview/<mode>` for staff previewing ("read only": every write refuses).
 */

export type ApiProblem = {
  status: number;
  error: string;
  problem?: string;
  title?: string;
  message?: string;
  canRequestAccess?: boolean;
  clientName?: string | null;
  code?: string;
  latestRevision?: number;
};

export class ApiFailure extends Error {
  constructor(public readonly info: ApiProblem) {
    super(info.error);
  }
}

export interface ClientApi {
  readOnly: boolean;
  load(opts?: { firstLoad?: boolean }): Promise<ClientPagePayload>;
  identify(name: string, email?: string): Promise<void>;
  saveOps(baseRevision: number, ops: WorkflowOp[]): Promise<{ revision: number }>;
  suggest(baseRevision: number, ops: WorkflowOp[], summary?: string): Promise<void>;
  resolveSuggestion(id: string, action: "withdraw" | "accept" | "reject"): Promise<{ status: string; message?: string }>;
  comment(input: { pageId: string; nodeId?: string; edgeId?: string; parentId?: string; versionId?: string; body: string }): Promise<void>;
  setCommentStatus(id: string, status: "open" | "resolved"): Promise<void>;
  feedback(input: { action: "approved" | "changes_requested"; comment?: string; versionId?: string }): Promise<void>;
  poll(): Promise<{ revision: number; pendingSuggestions: number; openComments: number; others: { name: string; editing: boolean }[] }>;
  heartbeat(editing: boolean): Promise<{ others: { name: string; editing: boolean }[] }>;
  requestAccess(input: { name: string; email?: string; message?: string }): Promise<void>;
}

async function request<T>(url: string, init: RequestInit & { passcode?: string | null } = {}): Promise<T> {
  const { passcode, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(passcode ? { "x-wf-passcode": passcode } : {}), ...(rest.headers ?? {}) },
    credentials: "same-origin",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiFailure({ status: res.status, error: body.error ?? "Something went wrong.", ...body });
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export function tokenApi(token: string, passcode?: string | null): ClientApi {
  const base = `/api/w/${token}`;
  const withPass = <T extends RequestInit>(init: T) => ({ ...init, passcode });
  return {
    readOnly: false,
    load: ({ firstLoad } = {}) => request(base, withPass({ headers: firstLoad ? { "x-wf-first-load": "1" } : {} })),
    identify: async (name, email) => void (await request(`${base}/identify`, withPass(post({ name, email: email ?? "" })))),
    saveOps: (baseRevision, ops) => request(`${base}/ops`, withPass(post({ baseRevision, ops }))),
    suggest: async (baseRevision, ops, summary) => void (await request(`${base}/suggestions`, withPass(post({ baseRevision, ops, summary })))),
    resolveSuggestion: (id, action) => request(`${base}/suggestions/${id}`, withPass(post({ action }))),
    comment: async (input) => void (await request(`${base}/comments`, withPass(post(input)))),
    setCommentStatus: async (id, status) => void (await request(`${base}/comments/${id}`, withPass({ method: "PATCH", body: JSON.stringify({ status }) }))),
    feedback: async (input) => void (await request(`${base}/feedback`, withPass(post(input)))),
    poll: () => request(`${base}/revision`, withPass({})),
    heartbeat: (editing) => request(`${base}/presence`, withPass(post({ editing }))),
    requestAccess: async (input) => void (await request(`${base}/request-access`, post(input))),
  };
}

/** Staff "Preview as...": the same page data, but nothing can be saved. */
export function previewApi(workflowId: string, mode: string): ClientApi {
  const base = `/api/workflows/${workflowId}/preview/${mode}`;
  const refuse = async (): Promise<never> => {
    throw new ApiFailure({ status: 403, error: "This is a preview. Nothing is saved." });
  };
  return {
    readOnly: true,
    load: () => request(base),
    identify: refuse,
    saveOps: refuse,
    suggest: refuse,
    resolveSuggestion: refuse,
    comment: refuse,
    setCommentStatus: refuse,
    feedback: refuse,
    poll: async () => ({ revision: -1, pendingSuggestions: 0, openComments: 0, others: [] }),
    heartbeat: async () => ({ others: [] }),
    requestAccess: refuse,
  };
}
