import { ReactNode } from 'react';

export interface BadgeProps {
  tone?: 'success' | 'info' | 'highlight' | 'attention' | 'warning' | 'danger' | 'neutral';
  solid?: boolean;
  children: ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
