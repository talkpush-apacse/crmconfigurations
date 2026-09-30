export interface TermItemProps {
  label: string;
  value?: string;
  featured?: boolean;
  included?: boolean;
}

export function TermItem(props: TermItemProps): JSX.Element;
