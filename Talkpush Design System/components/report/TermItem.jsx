import React from 'react';

export function TermItem({ label, value, featured = false, included = false }) {
  if (included) {
    return (
      <div style={{
        position: 'relative', border: '1.5px dashed var(--border-hairline)', background: 'var(--color-beige)',
        borderRadius: 8, padding: '12px 16px 12px 22px', fontSize: 13, color: 'var(--text-primary)'
      }}>
        <span style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, background: 'var(--color-green)', borderRadius: '4px 0 4px 0' }} />
        {label}
      </div>
    );
  }
  return (
    <div style={{
      borderLeft: `3px solid ${featured ? 'var(--color-orange)' : 'var(--border-hairline)'}`,
      background: 'var(--color-beige)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
      fontSize: 13, color: 'var(--text-primary)'
    }}>
      <span>{label}</span>
      {value && <span style={{ fontWeight: 700 }} className="num">{value}</span>}
    </div>
  );
}
