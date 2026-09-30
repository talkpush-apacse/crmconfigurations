import React, { useState } from 'react';

const BASE = {
  fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: '-0.01em',
  border: '1px solid transparent', cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', gap: 8,
  borderRadius: 'var(--sign-radius-control, 4px)', transition: 'transform .12s ease, background-color .15s ease, opacity .15s ease'
};

const SIZES = {
  sm: { height: 36, padding: '0 14px', fontSize: 13 },
  default: { height: 48, padding: '0 24px', fontSize: 15 },
  lg: { height: 56, padding: '0 30px', fontSize: 16 }
};

function variantStyle(variant, hover, active) {
  const map = {
    default: { background: '#141414', color: '#fff' },
    cta: { background: 'var(--sign-pink, #F1C1F3)', color: '#141414' },
    accent: { background: 'var(--color-orange)', color: 'var(--color-ink)' },
    sage: { background: 'var(--color-green)', color: 'var(--color-ink)' },
    destructive: { background: 'var(--sign-destructive, #D1483D)', color: '#fff' },
    secondary: { background: 'var(--sign-secondary, #F7F6E9)', color: 'var(--color-ink)' },
    outline: { background: 'transparent', color: 'var(--color-ink)', borderColor: 'var(--color-line)' },
    ghost: { background: 'transparent', color: 'var(--color-ink)' },
    link: { background: 'transparent', color: 'var(--color-blue-darker)', padding: 0, height: 'auto', textDecoration: hover ? 'underline' : 'none' }
  };
  const s = map[variant] || map.default;
  if (hover) s.opacity = 0.88;
  if (active) return { ...s, transform: 'scale(0.98)', opacity: 1 };
  return s;
}

export function Button({ variant = 'default', size = 'default', disabled = false, icon = null, children, onClick, type = 'button' }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const style = {
    ...BASE, ...(variant === 'link' ? {} : SIZES[size]),
    ...variantStyle(variant, hover, active),
    opacity: disabled ? 0.45 : (variantStyle(variant, hover, active).opacity ?? 1),
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={style}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}>
      {icon}{children}
    </button>
  );
}
