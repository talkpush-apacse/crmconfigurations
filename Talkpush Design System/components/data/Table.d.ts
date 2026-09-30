export interface TableColumn { key: string; label: string; render?: (value: any, row: any) => any; }
export interface TableProps {
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  variant?: 'report' | 'sign';
}

export function Table(props: TableProps): JSX.Element;
