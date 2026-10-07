import { accountProperty } from "./account-property";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

const workflowIdProperty = {
  type: "string",
  description: "Workflow project ID returned by create_workflow or create_workflow_from_spec.",
};

const templateIdProperty = {
  type: "string",
  description: "Workflow template ID returned by list_templates.",
};

const nodeIdProperty = {
  type: "string",
  description: "Workflow node ID.",
};

const nodeTypeProperty = {
  type: "string",
  enum: [
    "source",
    "stage",
    "decision",
    "communication",
    "integration",
    "parallel",
    "wait",
    "manual_action",
    "table",
    "terminator",
    "jump",
    "note",
  ],
  description:
    "Step kinds. Process Map style also has: terminator (an end state; set endKind), jump (a purple marker pointing at another step; set jumpToNodeId), note (a floating note; set noteKind and the text in notes).",
};

const ACTION_TYPES = ["candidate", "move", "call", "ai", "message", "alert", "system", "add_data", "read_data", "get_data", "send_data", "rejection_reason", "export", "share_profile", "wait"];

/** Process Map settings, accepted when creating or changing a step. */
const processMapProperties = {
  actionType: {
    type: ["string", "null"],
    enum: [...ACTION_TYPES, null],
    description:
      "The tag on the box (one-to-one with the Action Type). move = ANY folder move incl. automatic move to Rejected (never system); message = to a candidate/outside person; alert = to an internal person; ai = an AI-conducted interview only; null = no tag (a genuinely manual step or a decision).",
  },
  personActs: {
    type: "boolean",
    description: "true = a person acts in this step (white box, role in brackets, people icon). false = the system does it (green). Leave out to work it out from the actor.",
  },
  endKind: { type: "string", enum: ["success", "failure", "neutral", "soft"], description: "For a terminator: success = dark green, failure = pink, neutral = grey hand-off, soft = light green." },
  noteKind: { type: "string", enum: ["info", "rejection", "needs_input", "out_of_scope"], description: "For a note: info = yellow, needs_input = orange 'To confirm with the client' (title it 'To confirm with <client name>' to match the diagram key), rejection = pink, out_of_scope = grey." },
  jumpToNodeId: { type: "string", description: "For a jump marker: the step it points at (a node id, or a tempId in a spec)." },
  attachTo: { type: "string", description: "For a note: the step to place it beside (a node id, or a tempId in a spec)." },
  timing: { type: "string", description: "When it happens, shown in italics on the box's last line, for example 'Day before the interview'. REQUIRED for every automated message, call or alert ('immediately', '1 hour after', '2 days after'); put its channel in data.channel ('Email', 'SMS', 'Email + SMS', 'WhatsApp', 'Voice call') and the box shows 'Email · 1 hour after'. Unknown: add an orange to-confirm note, never guess." },
  lane: { type: "string", description: "Lanes layout: the row this step sits in, in the client's words and spelled the same everywhere (for example 'Candidate', 'Recruiter', 'Assessment platform', 'HRIS'). Leave out to use the step's actor. Empty text clears it. A diagram is drawn as lanes when its steps carry lanes." },
  stage: { type: "string", description: "Lanes layout: the stage band this step starts, a short plain phrase (for example '2. Assessment'). Steps after it stay in that stage until the next one that sets a stage. Empty text clears it." },
  external: { type: "boolean", description: "Lanes layout: true when this step's lane is another system (assessment platform, HRIS, a vendor): the lane is drawn blue and data crossing to or from it is a dashed line." },
  internalNotes: { type: "string", description: "Staff-only notes. Never shown to clients." },
  visibility: { type: "string", enum: ["client", "internal"], description: "internal = hidden from every client view, export and shared link." },
};

const actorProperty = {
  type: "string",
  enum: ["automated", "manual", "integration", "candidate", "source"],
};

const feasibilityProperty = {
  type: "string",
  enum: ["confirmed", "likely", "needs_review"],
};

const customColorProperty = {
  type: ["object", "null"],
  properties: {
    name: { type: "string" },
    background: { type: "string" },
    border: { type: "string" },
  },
  required: ["background", "border"],
  additionalProperties: false,
};

const artifactKindProperty = {
  type: "string",
  enum: [
    "assumption",
    "open_question",
    "risk",
    "decision",
    "call_note",
    "customer_summary",
  ],
};

const artifactStatusProperty = {
  type: "string",
  enum: ["open", "confirmed", "resolved", "dismissed"],
};

const severityProperty = {
  type: "string",
  enum: ["info", "low", "medium", "high", "critical"],
};

const artifactSourceProperty = {
  type: "string",
  enum: ["mcp", "manual", "transcript", "validation"],
};

const talkpushMetadataProperty = {
  type: "object",
  description:
    "Typed but flexible Talkpush metadata such as channel, messageTemplate, campaignType, talkpushStage, talkpushAction, targetFolder, waitDuration, integrationSystem, integrationDirection, ownerRole, and customFields.",
  additionalProperties: true,
};

const workflowSpecNodeProperty = {
  type: "object",
  properties: {
    tempId: { type: "string", description: "Temporary node ID used by spec edges." },
    type: nodeTypeProperty,
    label: { type: "string" },
    actor: actorProperty,
    actorLabel: { type: "string" },
    notes: { type: "string", description: "Extra detail shown in the box. May use **bold**, *italic* and __underline__ for emphasis; keep it short." },
    feasibility: feasibilityProperty,
    feasibilityNote: { type: "string" },
    position: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" } },
      required: ["x", "y"],
      additionalProperties: false,
    },
    customColor: customColorProperty,
    data: talkpushMetadataProperty,
    ...processMapProperties,
  },
  required: ["tempId", "type", "label"],
  additionalProperties: false,
};

const workflowSpecEdgeProperty = {
  type: "object",
  properties: {
    tempId: { type: "string", description: "Optional temporary edge ID for response mapping." },
    sourceTempId: { type: "string" },
    targetTempId: { type: "string" },
    label: { type: "string" },
    isHappyPath: {
      type: "boolean",
      description:
        "When true, this edge becomes the only happy path leaving its source.",
    },
    isRecovery: { type: "boolean" },
    isPrimary: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
  required: ["sourceTempId", "targetTempId"],
  additionalProperties: false,
};

const scopingArtifactProperty = {
  type: "object",
  properties: {
    kind: artifactKindProperty,
    title: { type: "string" },
    detail: { type: "string" },
    status: artifactStatusProperty,
    severity: severityProperty,
    owner: { type: "string" },
    source: artifactSourceProperty,
    metadata: { type: "object", additionalProperties: true },
  },
  required: ["kind", "title", "detail"],
  additionalProperties: false,
};

const workflowSpecProperties = {
  clientName: { type: "string" },
  workflowName: { type: "string" },
  description: { type: "string" },
  nodes: {
    type: "array",
    items: workflowSpecNodeProperty,
    description:
      "Nodes with temporary IDs. Add a source node first whenever possible.",
  },
  edges: {
    type: "array",
    items: workflowSpecEdgeProperty,
    description:
      "Edges connecting node temp IDs. Mark positive decision/parallel paths with isHappyPath.",
  },
  artifacts: { type: "array", items: scopingArtifactProperty },
  summary: {
    type: "string",
    description:
      "Optional customer summary text. If omitted, the server creates a deterministic summary.",
  },
  account: accountProperty,
  autoLayout: {
    type: "boolean",
    description: "Defaults to true. Arranges the diagram before saving (the Process Map spine layout, or Dagre for the Classic style).",
  },
  diagramStyle: {
    type: "string",
    enum: ["process_map", "classic"],
    description: "Defaults to process_map: the Lucid-style diagram with decimal numbering. Use classic only if asked.",
  },
  look: {
    type: "string",
    enum: ["readable", "original"],
    description: "Defaults to readable (bigger text, calmer colour, accent main path). Use original only to match an older map.",
  },
  layoutDirection: {
    type: "string",
    enum: ["TB", "LR"],
    description: "Layout direction. TB = top-to-bottom (default), LR = left-to-right (horizontal).",
  },
};

const originalDefinitions: McpToolDefinition[] = [
  {
    name: "create_workflow_from_spec",
    description:
      "Create a complete workflow in one call from structured nodes, edges, Talkpush metadata, and scoping artifacts. Returns editUrl, node/edge ID maps, validation findings, step numbering, and a customer summary.",
    inputSchema: {
      type: "object",
      properties: workflowSpecProperties,
      required: ["clientName", "workflowName", "nodes"],
      additionalProperties: false,
    },
  },
  {
    name: "create_workflow_from_scoping_notes",
    description:
      "Create a complete workflow from Claude-interpreted scoping notes. Claude supplies the structured spec; the server stores the original notes as a call_note artifact and deterministically creates, validates, lays out, and summarizes the workflow.",
    inputSchema: {
      type: "object",
      properties: {
        ...workflowSpecProperties,
        scopingNotes: { type: "string" },
        transcript: { type: "string" },
        callNoteTitle: { type: "string" },
      },
      required: ["clientName", "workflowName", "nodes"],
      additionalProperties: false,
    },
  },
  {
    name: "list_workflows",
    description:
      "Find existing workflow maps by client, workflow name, or status and return edit URLs plus node/edge counts. Each result says which account it is filed under (account: null means it waits under \"Needs an account\").",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        status: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "duplicate_workflow",
    description:
      "Copy an existing workflow into a new project with fresh node and edge IDs.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        clientName: { type: "string" },
        workflowName: { type: "string" },
        description: { type: "string" },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_templates",
    description:
      "List reusable SE workflow templates such as high-volume screening, interview scheduling, onboarding, ATS sync, parallel checks, and referrals.",
    inputSchema: {
      type: "object",
      properties: {
        industry: { type: "string", enum: ["all", "bpo", "retail", "general"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_template",
    description:
      "Fetch a reusable workflow template with its saved nodes and edges.",
    inputSchema: {
      type: "object",
      properties: { templateId: templateIdProperty },
      required: ["templateId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_from_template",
    description:
      "Create a new workflow project from a reusable template, clone fresh node/edge IDs, run layout, and return validation plus step numbering.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: templateIdProperty,
        clientName: { type: "string" },
        account: accountProperty,
        workflowName: { type: "string" },
        description: { type: "string" },
      },
      required: ["templateId", "clientName", "workflowName"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_workflow",
    description:
      "Run deterministic SE validation on a workflow: missing source, orphan nodes, bad branches, missing metadata, duplicate labels, recovery issues, and feasibility gaps.",
    inputSchema: {
      type: "object",
      properties: { workflowId: workflowIdProperty },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_scoping_artifact",
    description:
      "Store an assumption, open question, risk, decision, call note, or customer summary on a workflow.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        ...scopingArtifactProperty.properties,
      },
      required: ["workflowId", "kind", "title", "detail"],
      additionalProperties: false,
    },
  },
  {
    name: "list_scoping_artifacts",
    description:
      "List scoping artifacts for a workflow, optionally filtered by kind or status.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        kind: artifactKindProperty,
        status: artifactStatusProperty,
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "update_scoping_artifact",
    description:
      "Update a scoping artifact's title, detail, status, severity, owner, source, kind, or metadata.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        artifactId: { type: "string" },
        ...scopingArtifactProperty.properties,
      },
      required: ["workflowId", "artifactId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_scoping_artifact",
    description:
      "Delete a scoping artifact from a workflow. Use only when the artifact is no longer useful; status updates are preferred for resolved/dismissed items.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        artifactId: { type: "string" },
      },
      required: ["workflowId", "artifactId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_call_note",
    description:
      "Store call notes or transcript excerpts as a call_note artifact tied to a workflow.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        title: { type: "string" },
        detail: { type: "string" },
        note: { type: "string" },
        transcript: { type: "string" },
        owner: { type: "string" },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_version_snapshot",
    description:
      "Save the current workflow canvas as a version snapshot before a major scoping revision or customer review. Returns the version's number, label and counts, not the whole canvas; read it back with diff_versions.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        label: { type: "string" },
        createdByName: { type: "string" },
        triggerDetail: { type: "string" },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_versions",
    description:
      "List saved workflow versions with version numbers, labels, statuses, and node/edge counts.",
    inputSchema: {
      type: "object",
      properties: { workflowId: workflowIdProperty },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "restore_version",
    description:
      "Restore a workflow to a saved version. The server snapshots the current state before and after restore.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        versionId: { type: "string" },
      },
      required: ["workflowId", "versionId"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_customer_summary",
    description:
      "Create and store a customer handoff summary from the workflow, validation findings, assumptions, risks, and open questions. Returns summary text plus editUrl.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        title: { type: "string" },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "share_workflow",
    description:
      "Explicitly generate or reuse a public workflow review link. This is never called automatically after transcript creation.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        shareVersionId: { type: "string" },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_workflow",
    description:
      "Create an empty workflow project for a client and return the workflow ID plus edit URL.",
    inputSchema: {
      type: "object",
      properties: {
        clientName: { type: "string" },
        account: accountProperty,
        workflowName: { type: "string" },
        description: { type: "string" },
      },
      required: ["clientName", "workflowName"],
      additionalProperties: false,
    },
  },
  {
    name: "get_workflow",
    description:
      "Fetch a workflow with nodes, edges, status, server-computed step numbers and its current `revision` (pass it as baseRevision on changes).",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_node",
    description:
      "Add a node to a workflow. Valid process node types: source - application received or candidate applies; stage - screening, interview, assessment, or normal process step; decision - pass/fail or qualified/not-qualified branch; communication - SMS, email, WhatsApp, Messenger, voice, or recruiter notification; integration - ATS, HRIS, Workday, or vendor sync; parallel - simultaneous workstreams; wait - delay or hold until a condition is met; manual_action - recruiter or hiring manager review. The table type is also available for structured reference data.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        type: nodeTypeProperty,
        label: { type: "string" },
        actor: actorProperty,
        actorLabel: { type: "string" },
        notes: { type: "string" },
        feasibility: feasibilityProperty,
        feasibilityNote: { type: "string" },
        customColor: customColorProperty,
        data: talkpushMetadataProperty,
        ...processMapProperties,
      },
      required: ["workflowId", "type", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "update_node",
    description:
      "Update editable fields, Talkpush metadata, and custom color on an existing workflow node without changing connected edges.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        nodeId: nodeIdProperty,
        label: { type: "string" },
        actor: actorProperty,
        actorLabel: { type: "string" },
        notes: { type: "string" },
        feasibility: feasibilityProperty,
        feasibilityNote: { type: "string" },
        type: nodeTypeProperty,
        customColor: customColorProperty,
        data: talkpushMetadataProperty,
        ...processMapProperties,
      },
      required: ["workflowId", "nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_node",
    description:
      "Delete a workflow node and automatically remove every edge connected to it.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        nodeId: nodeIdProperty,
      },
      required: ["workflowId", "nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_edge",
    description:
      "Connect two workflow nodes with a regular edge. When isHappyPath is true, this edge becomes the only happy path leaving the source node and sibling outgoing happy-path flags are cleared. Use for forward flow and new branch paths.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        sourceNodeId: nodeIdProperty,
        targetNodeId: nodeIdProperty,
        isHappyPath: { type: "boolean" },
        isPrimary: { type: "boolean" },
        label: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["workflowId", "sourceNodeId", "targetNodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_recovery_edge",
    description:
      "Connect a branch back to an existing main-flow step. Use this instead of add_edge when a branch rejoins a node that already exists; regular edges are for forward flow and new branch paths. The server computes the recovery label.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        sourceNodeId: nodeIdProperty,
        targetNodeId: nodeIdProperty,
        label: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      required: ["workflowId", "sourceNodeId", "targetNodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "auto_layout",
    description:
      "Run the layout on the current workflow and save the new positions (Process Map style keeps the main path on one row and puts each note beside its step). A snapshot is taken first, so it can be undone. Returns how many steps moved, not every node.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        direction: {
          type: "string",
          enum: ["TB", "LR"],
          description: "Layout direction. TB = top-to-bottom (default), LR = left-to-right (horizontal).",
        },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "renumber_steps",
    description:
      "Compute step numbers and missing happy-path warnings for the current workflow.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    name: "design_campaign_structure",
    description:
      "Inject annotation nodes onto the workflow canvas to visually mark campaign boundaries, swim lanes, or grouping overlays. All injected nodes must be annotation-type canvas layers (data.isAnnotation = true). Existing annotations can be preserved (append) or replaced (replace_annotations).",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
        annotations: {
          type: "array",
          description: "Annotation nodes to inject onto the canvas.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique node ID (e.g. 'ann_campaign_1')." },
              shape: {
                type: "string",
                enum: ["rect", "rounded-rect", "circle", "diamond", "text-label", "divider"],
              },
              label: { type: "string" },
              position: {
                type: "object",
                properties: { x: { type: "number" }, y: { type: "number" } },
                required: ["x", "y"],
                additionalProperties: false,
              },
              width: { type: "number", description: "Node width in pixels." },
              height: { type: "number", description: "Node height in pixels." },
              fillColor: {
                type: "string",
                description: "CSS color string or 'transparent'. Default: 'transparent'.",
              },
              borderColor: {
                type: "string",
                description: "CSS color string or 'none'. Default: '#00BFA5'.",
              },
              borderStyle: {
                type: "string",
                enum: ["solid", "dashed", "none"],
              },
              fontSize: { type: "number" },
              textAlign: { type: "string", enum: ["left", "center", "right"] },
              opacity: { type: "number", minimum: 0.1, maximum: 1, description: "CSS opacity 0.1–1.0. Default: 0.8." },
              bold: { type: "boolean" },
              italic: { type: "boolean" },
              zIndex: {
                type: "number",
                description: "Render depth. Use negative values (-1 to -3) to place behind workflow nodes, positive (1–10) to overlay on top.",
              },
            },
            required: ["id", "shape", "label", "position"],
            additionalProperties: false,
          },
        },
        mergeStrategy: {
          type: "string",
          enum: ["append", "replace_annotations"],
          description: "'append' adds to existing annotations; 'replace_annotations' removes all current annotations first. Default: 'replace_annotations'.",
        },
      },
      required: ["workflowId", "annotations"],
      additionalProperties: false,
    },
  },
  {
    name: "clear_campaign_structure",
    description:
      "Remove all annotation nodes and their connecting edges from the workflow canvas, leaving workflow nodes untouched.",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: workflowIdProperty,
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
];

// ---- version 2 additions -----------------------------------------------------------------------------

import { v2Definitions } from "./definitions-v2";

/** Tools that read or change one page of a workflow take an optional `page`. */
const PAGE_AWARE = new Set(["get_workflow", "add_node", "update_node", "delete_node", "add_edge", "add_recovery_edge", "auto_layout", "renumber_steps", "validate_workflow"]);
const NO_REVISION_GUARD = new Set(["get_workflow", "list_workflows", "list_templates", "get_template", "list_versions", "list_scoping_artifacts", "validate_workflow", "renumber_steps", "list_pages", "get_flow_table", "run_gap_check", "lint_layout", "render_preview", "diff_versions", "list_access", "list_suggestions", "list_comments", "create_workflow", "create_workflow_from_spec", "create_workflow_from_scoping_notes", "create_workflow_from_flow_table", "create_from_template", "duplicate_workflow"]);

function withCommonOptions(def: McpToolDefinition): McpToolDefinition {
  const props: Record<string, unknown> = { ...def.inputSchema.properties };
  if (PAGE_AWARE.has(def.name) && !props.page) {
    props.page = { type: "string", description: "Which page: its id, its name, or its number (1 = first). Default: the first page." };
  }
  if (props.workflowId && !NO_REVISION_GUARD.has(def.name) && !props.baseRevision) {
    props.baseRevision = {
      type: "integer",
      description: "Optional safety check: the revision you last read (get_workflow shows it, and every change returns the new one). If someone changed the workflow since, the change is refused instead of overwriting their work.",
    };
  }
  return { ...def, inputSchema: { ...def.inputSchema, properties: props } };
}

export const workflowToolDefinitions: McpToolDefinition[] = [...originalDefinitions, ...v2Definitions].map(withCommonOptions);
