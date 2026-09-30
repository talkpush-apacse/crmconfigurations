import React, { useState } from 'react';

export function Select({ label, options = [], value, onChange, disabled = false }) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', width: '100%' }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>}
      <select value={value} onChange={onChange} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 44, borderRadius: 'var(--sign-radius-control, 4px)', padding: '0 14px',
          border: `1px solid ${focused ? 'var(--color-blue-darker)' : 'var(--border-hairline)'}`,
          outline: focused ? '3px solid var(--color-blue-soft)' : 'none',
          fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--text-primary)', background: '#fff'
        }}>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </label>
  );
}
