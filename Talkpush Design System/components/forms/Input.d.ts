export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: any) => void;
  type?: string;
  error?: string;
  disabled?: boolean;
}

export function Input(props: InputProps): JSX.Element;
