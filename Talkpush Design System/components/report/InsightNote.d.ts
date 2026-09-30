import { ReactNode } from 'react';

export interface InsightNoteProps {
  children: ReactNode;
  accent?: string;
}

export function InsightNote(props: InsightNoteProps): JSX.Element;
