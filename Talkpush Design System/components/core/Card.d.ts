import { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  padding?: number;
  accent?: string;
  hover?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
