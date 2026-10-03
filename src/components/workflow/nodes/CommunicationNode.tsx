"use client";

import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { WorkflowNodeData } from "@/lib/workflow/types";

export default function CommunicationNode({ id, data, selected }: NodeProps) {
  return <BaseNode id={id} data={data as unknown as WorkflowNodeData} selected={selected} />;
}
