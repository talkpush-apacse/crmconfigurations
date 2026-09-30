export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'success' | 'attention' | 'highlight' | 'info';
}

export function KpiCard(props: KpiCardProps): JSX.Element;
