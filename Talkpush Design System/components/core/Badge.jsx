import React from 'react';

const TONES = {
  success: { fg: 'var(--color-green-darker)', bg: 'var(--color-green-soft)' },
  info: { fg: 'var(--color-blue-darker)', bg: 'var(--color-blue-soft)' },
  highlight: { fg: 'var(--color-pink-darker)', bg: 'var(--color-pink-soft)' },
  attention: { fg: 'var(--color-accent-ink)', bg: 'var(--color-orange-soft)' },
  warning: { fg: '#8a5a1c', bg: 'color-mix(in srgb, var(--color-alert-amber) 20%, white)' },
  danger: { fg: '#7a2a22', bg: 'color-mix(in srgb, var(--color-alert-red) 18%, white)' },
  neutral: { fg: 'var(--text-muted)', bg: 'var(--color-line)' }
};

export function Badge({ tone = 'neutral', solid = false, children }) {
  const t = TONES[tone] || TONES.neutral;
  const style = solid
    ? { background: t.fg, color: '#fff' }
    : { background: t.bg, color: t.fg };
  return (
    <span style={{
      ...style, display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 'var(--radius-full)', lineHeight: 1.4
    }}>{children}</span>
  );
}
