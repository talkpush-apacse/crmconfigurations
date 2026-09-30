import { ReactNode } from 'react';

export interface ButtonProps {
  variant?: 'default' | 'cta' | 'accent' | 'sage' | 'destructive' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export function Button(props: ButtonProps): JSX.Element;
