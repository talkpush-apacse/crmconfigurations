export interface ChevronStep { label: string; color?: string; }
export interface ChevronFlowProps {
  steps: ChevronStep[];
}

export function ChevronFlow(props: ChevronFlowProps): JSX.Element;
