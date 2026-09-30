import React, { useState } from 'react';

export function Tabs({ items, defaultValue, onChange }) {
  const [active, setActive] = useState(defaultValue || (items[0] && items[0].value));
  const select = v => { setActive(v); onChange && onChange(v); };
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-hairline)' }}>
      {items.map(it => {
        const isActive = it.value === active;
        return (
          <button key={it.value} onClick={() => select(it.value)} style={{
            border: 'none', background: 'none', cursor: 'pointer', padding: '10px 16px',
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: isActive ? '2px solid var(--color-ink)' : '2px solid transparent',
            marginBottom: -1
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}
