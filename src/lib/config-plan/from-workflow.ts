import { deriveFlowTable } from "@/lib/workflow/process-map/flow-table";
import { actionTypeOf, personActs, shapeKindOf } from "@/lib/workflow/process-map/model";
import { clean, normalizeName } from "./names";
import type { SectionKey, StepRef, Unresolved } from "./types";

/**
 * Reads a Process Workflow into the things it says must exist in the CRM.
 *
 * A step can name something in a dedicated field (targetFolder, messageTemplate, integrationSystem): that is
 * reliable ("field"). Otherwise the name has to be read from the step's title ("wording"): a person should check it.
 * When a step needs a CRM object but names nothing, it goes to `unresolved`. A name is never invented.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Found {
  name: string;
  detail?: string;
  steps: StepRef[];
}

export interface WorkflowFindings {
  folders: Found[];
  messageTemplates: Found[];
  questionSets: Found[];
  rejectionReasons: Found[];
  aiAgents: Found[];
  integrations: Found[];
  campaignTypes: string[];
  /** Steps Talkpush performs on its own: each is a candidate for one autoflow. */
  automatedSteps: StepRef[];
  unresolved: Unresolved[];
  stepCount: number;
}

const MOVE_WORDING = /^(?:move|moves|moved|moving)\s+(?:the\s+)?(?:candidate\s+|application\s+)?(?:to|into)\s+(?:the\s+)?(.+?)(?:\s+folder|\s+stage)?$/i;
const SKIP_TYPES = new Set(["swimlane", "frame", "annotation", "dangling_endpoint"]);

function pagesOf(workflow: { pages?: unknown; nodes?: unknown; edges?: unknown }): { nodes: any[]; edges: any[] }[] {
  const pages = Array.isArray(workflow.pages) ? (workflow.pages as any[]) : [];
  const usable = pages.filter((p) => p && Array.isArray(p.nodes));
  if (usable.length > 0) return usable.map((p) => ({ nodes: p.nodes, edges: Array.isArray(p.edges) ? p.edges : [] }));
  return Array.isArray(workflow.nodes) ? [{ nodes: workflow.nodes as any[], edges: Array.isArray(workflow.edges) ? (workflow.edges as any[]) : [] }] : [];
}

class Bucket {
  private map = new Map<string, Found>();
  add(name: string, step: StepRef, detail?: string) {
    const key = normalizeName(name);
    if (!key) return;
    const have = this.map.get(key);
    if (have) {
      have.steps.push(step);
      if (!have.detail && detail) have.detail = detail;
    } else {
      this.map.set(key, { name: clean(name), detail, steps: [step] });
    }
  }
  list(): Found[] {
    return [...this.map.values()];
  }
}

export function readWorkflow(workflow: { pages?: unknown; nodes?: unknown; edges?: unknown }): WorkflowFindings {
  const folders = new Bucket();
  const templates = new Bucket();
  const questionSets = new Bucket();
  const reasons = new Bucket();
  const aiAgents = new Bucket();
  const integrations = new Bucket();
  const campaignTypes = new Set<string>();
  const automated: StepRef[] = [];
  const unresolved: Unresolved[] = [];
  let stepCount = 0;

  const pages = pagesOf(workflow);
  const multiPage = pages.length > 1;

  pages.forEach((page, pageIndex) => {
    const stepOf = new Map<string, string>();
    try {
      for (const row of deriveFlowTable(page.nodes, page.edges).rows) stepOf.set(row.nodeId, row.step);
    } catch {
      // A diagram that cannot be numbered still gets read; its steps just have no number.
    }

    for (const node of page.nodes) {
      const type = node?.type ?? node?.data?.type;
      if (!node || SKIP_TYPES.has(type)) continue;
      const kind = shapeKindOf(node);
      const action = actionTypeOf(node);
      const d = node.data ?? {};
      const meta = d.data && typeof d.data === "object" ? d.data : {};
      const label = clean(d.label);
      if (!label && !meta.targetFolder && !meta.messageTemplate) continue;
      if (kind === "note" && action !== "rejection_reason") continue;
      if (kind === "start" || kind === "end" || kind === "jump" || kind === "decision" || kind === "none" || kind === "container") {
        if (kind !== "decision" || !meta.targetFolder) continue;
      }
      stepCount++;

      const numbered = stepOf.get(node.id) ?? "";
      const step = multiPage && numbered ? `p${pageIndex + 1}.${numbered}` : numbered;
      const ref = (basis: "field" | "wording"): StepRef => ({ step, label, basis });
      const unresolve = (section: SectionKey, reason: string) => unresolved.push({ section, step, label, reason });

      const talkpushAction = clean(meta.talkpushAction);

      // Folders
      const targetFolder = clean(meta.targetFolder);
      const stageName = clean(meta.talkpushStage);
      if (targetFolder) {
        folders.add(targetFolder, ref("field"));
      } else if (type === "stage" && (stageName || label)) {
        folders.add(stageName || label, ref(stageName ? "field" : "wording"));
      } else if (action === "move") {
        const m = MOVE_WORDING.exec(label);
        if (m) folders.add(m[1], ref("wording"));
        else unresolve("folders", "A move step that does not say which folder.");
      }

      // Question sets, message templates
      const templateName = clean(meta.messageTemplate);
      const channel = clean(meta.channel);
      if (talkpushAction === "send_question_set") {
        if (templateName) questionSets.add(templateName, ref("field"));
        else unresolve("questions", "Sends a question set without naming it.");
      } else if (templateName) {
        templates.add(templateName, ref("field"), channel || undefined);
      } else if (action === "message") {
        unresolve("message_templates", "A message step without a template name.");
      }

      // Rejection reasons
      if (action === "rejection_reason") {
        const reason = label.replace(/^(?:rejection\s+)?reason\s*[:\-]\s*/i, "");
        if (reason) reasons.add(reason, ref("wording"));
      }

      // AI agents, integrations, campaign types
      if (action === "ai" || talkpushAction === "voice_ai_call") aiAgents.add(label, ref("wording"));
      if (type === "integration" || action === "get_data" || action === "send_data") {
        const system = clean(meta.integrationSystem);
        const direction = clean(meta.integrationDirection);
        if (system) integrations.add(system, ref("field"), direction || undefined);
        else unresolve("integrations", "An integration step that does not name the other system.");
      }
      if (clean(meta.campaignType)) campaignTypes.add(clean(meta.campaignType));

      // Add data / labels: the thing to create is only in the wording
      if (action === "add_data" || talkpushAction === "assign_labels" || talkpushAction === "add_data") {
        unresolve(talkpushAction === "assign_labels" ? "labels" : "attributes", "Writes data or a label. The name is not given in a field, so check the wording.");
      }

      // Steps Talkpush does by itself: one autoflow each
      if (kind === "process" && !personActs(node) && action && action !== "wait" && action !== "read_data") {
        automated.push(ref("wording"));
      }
    }
  });

  return {
    folders: folders.list(),
    messageTemplates: templates.list(),
    questionSets: questionSets.list(),
    rejectionReasons: reasons.list(),
    aiAgents: aiAgents.list(),
    integrations: integrations.list(),
    campaignTypes: [...campaignTypes],
    automatedSteps: automated,
    unresolved,
    stepCount,
  };
}
