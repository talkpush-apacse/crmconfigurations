import React, { useState } from 'react';

export function Input({ label, placeholder, value, onChange, type = 'text', error = null, disabled = false }) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', width: '100%' }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>}
      <input
        type={type} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: 44, borderRadius: 'var(--sign-radius-control, 4px)', padding: '0 14px',
          border: `1px solid ${error ? 'var(--color-alert-red)' : (focused ? 'var(--color-blue-darker)' : 'var(--border-hairline)')}`,
          outline: focused ? '3px solid var(--color-blue-soft)' : 'none',
          fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
          background: disabled ? 'var(--color-line)' : '#fff', opacity: disabled ? 0.6 : 1
        }}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--color-alert-red)' }}>{error}</span>}
    </label>
  );
}
