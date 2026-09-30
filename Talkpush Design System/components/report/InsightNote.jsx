import React from 'react';

export function InsightNote({ children, accent = 'var(--color-blue)' }) {
  return (
    <div style={{
      borderLeft: `4px solid ${accent}`, background: 'var(--surface-card)',
      padding: '10px 16px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)',
      borderRadius: '0 6px 6px 0'
    }}>{children}</div>
  );
}
