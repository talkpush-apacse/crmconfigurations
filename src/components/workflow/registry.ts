import type { EdgeTypes, NodeTypes } from "@xyflow/react";
import StageNode from "./nodes/StageNode";
import DecisionNode from "./nodes/DecisionNode";
import IntegrationNode from "./nodes/IntegrationNode";
import CommunicationNode from "./nodes/CommunicationNode";
import ParallelNode from "./nodes/ParallelNode";
import WaitNode from "./nodes/WaitNode";
import ManualActionNode from "./nodes/ManualActionNode";
import SourceNode from "./nodes/SourceNode";
import TableNode from "./nodes/TableNode";
import SwimlaneNode from "./nodes/SwimlaneNode";
import FrameNode from "./nodes/FrameNode";
import AnnotationNode from "./nodes/AnnotationNode";
import DanglingEndpointNode from "./nodes/DanglingEndpointNode";
import CustomEdge from "./edges/CustomEdge";
import { ProcessMapContainer, ProcessMapEdge, ProcessMapLegend, ProcessMapNode, ProcessMapTable, ProcessMapTitle } from "./process-map/nodes";

/**
 * The one list of diagram pieces. The staff editor and the client page both use it, so what a client sees is
 * drawn by the same code as what staff build (the old client page left out notes and loose ends).
 */
export const workflowNodeTypes: NodeTypes = {
  stage: StageNode,
  decision: DecisionNode,
  integration: IntegrationNode,
  communication: CommunicationNode,
  parallel: ParallelNode,
  wait: WaitNode,
  manual_action: ManualActionNode,
  source: SourceNode,
  table: TableNode,
  swimlane: SwimlaneNode,
  frame: FrameNode,
  annotation: AnnotationNode,
  dangling_endpoint: DanglingEndpointNode,
};

export const workflowEdgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

/** The Process Map style draws every step with the shared Lucid-style shapes; the stored step types stay the same. */
export const processMapNodeTypes: NodeTypes = {
  stage: ProcessMapNode,
  decision: ProcessMapNode,
  integration: ProcessMapNode,
  communication: ProcessMapNode,
  parallel: ProcessMapNode,
  wait: ProcessMapNode,
  manual_action: ProcessMapNode,
  source: ProcessMapNode,
  terminator: ProcessMapNode,
  jump: ProcessMapNode,
  note: ProcessMapNode,
  table: ProcessMapTable,
  swimlane: SwimlaneNode,
  frame: FrameNode,
  annotation: AnnotationNode,
  dangling_endpoint: DanglingEndpointNode,
  pmContainer: ProcessMapContainer,
  pmTitle: ProcessMapTitle,
  pmLegend: ProcessMapLegend,
};

export const processMapEdgeTypes: EdgeTypes = {
  custom: ProcessMapEdge,
};

export type DiagramStyle = "classic" | "process_map";
export const nodeTypesFor = (style: DiagramStyle): NodeTypes => (style === "process_map" ? processMapNodeTypes : workflowNodeTypes);
export const edgeTypesFor = (style: DiagramStyle): EdgeTypes => (style === "process_map" ? processMapEdgeTypes : workflowEdgeTypes);
