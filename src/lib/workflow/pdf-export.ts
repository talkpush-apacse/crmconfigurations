import type { Edge, Node } from "@xyflow/react";

export interface WorkflowPdfOptions {
  clientName: string;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds?: string[];
  stepNumbers?: Map<string, string>;
}

/**
 * PDF export is not part of the first port. The old exporter needed the jsPDF library, which this app does
 * not have yet, and the spec replaces it with a new exporter in phase 3 (client-ready, multi-page, legend).
 * Until then the editor shows a plain message instead of failing silently.
 */
export async function exportWorkflowToPdf(options: WorkflowPdfOptions): Promise<void> {
  void options;
  throw new Error("PDF export is not available yet");
}
