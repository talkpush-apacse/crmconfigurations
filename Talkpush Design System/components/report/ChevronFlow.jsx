import React from 'react';

export function ChevronFlow({ steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            flex: 1, background: s.color || 'var(--color-blue-soft)', padding: '14px 18px',
            borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)'
          }}>{s.label}</div>
          {i < steps.length - 1 && (
            <svg width="18" height="24" viewBox="0 0 18 24" style={{ flex: 'none', margin: '0 -2px' }}>
              <path d="M2 2L14 12L2 22" stroke="var(--text-muted)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
