import React from 'react';
import { Badge } from '../core/Badge.jsx';

export function Table({ columns, rows, variant = 'report' }) {
  const wrapStyle = variant === 'sign'
    ? { border: '1px solid var(--sign-border, var(--border-hairline))', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }
    : { border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' };
  const headStyle = variant === 'sign'
    ? { background: 'var(--sign-secondary, #F7F6E9)', color: 'var(--text-primary)' }
    : { background: 'var(--color-ink)', color: '#fff' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', ...wrapStyle }}>
      <thead>
        <tr>
          {columns.map(c => (
            <th key={c.key} style={{ ...headStyle, textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 ? 'var(--row-stripe)' : 'transparent' }}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: '9px 14px', fontSize: 13, borderTop: '1px solid var(--border-hairline)', color: 'var(--text-primary)' }}>
                {c.render ? c.render(r[c.key], r) : r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
