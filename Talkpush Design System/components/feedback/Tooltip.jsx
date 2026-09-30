import React, { useState } from 'react';

export function Tooltip({ label, children, side = 'top' }) {
  const [show, setShow] = useState(false);
  const pos = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }
  }[side] || {};
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: 'absolute', ...pos, background: 'var(--color-ink)', color: '#fff',
          fontSize: 11, fontFamily: 'var(--font-body)', padding: '5px 9px', borderRadius: 6,
          whiteSpace: 'nowrap', boxShadow: 'var(--shadow-card-hover)', zIndex: 10
        }}>{label}</span>
      )}
    </span>
  );
}
