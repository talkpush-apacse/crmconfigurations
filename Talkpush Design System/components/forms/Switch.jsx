import React from 'react';

export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-primary)', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span onClick={() => !disabled && onChange && onChange({ target: { checked: !checked } })}
        style={{
          width: 40, height: 22, borderRadius: 999, position: 'relative', flex: 'none',
          background: checked ? 'var(--color-green)' : 'var(--color-line)', transition: 'background .15s ease'
        }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'left .15s ease'
        }} />
      </span>
      {label}
    </label>
  );
}
