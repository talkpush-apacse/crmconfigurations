import { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
}

export function Dialog(props: DialogProps): JSX.Element | null;
