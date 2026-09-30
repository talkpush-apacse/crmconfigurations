export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (e: any) => void;
  disabled?: boolean;
}

export function Checkbox(props: CheckboxProps): JSX.Element;
