export interface SwitchProps {
  checked?: boolean;
  onChange?: (e: any) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch(props: SwitchProps): JSX.Element;
