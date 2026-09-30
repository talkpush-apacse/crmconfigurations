export interface SelectOption { label?: string; value?: string; }
export interface SelectProps {
  label?: string;
  options: Array<SelectOption | string>;
  value?: string;
  onChange?: (e: any) => void;
  disabled?: boolean;
}

export function Select(props: SelectProps): JSX.Element;
