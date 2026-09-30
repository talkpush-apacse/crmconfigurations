import React from 'react';

export function Card({ padding = 24, accent = null, hover = false, children, style = {} }) {
  const [isHover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => hover && setHover(true)}
      onMouseLeave={() => hover && setHover(false)}
      style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-hairline)', padding,
        borderTop: accent ? `4px solid ${accent}` : undefined,
        boxShadow: isHover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transition: 'box-shadow .15s ease', ...style
      }}>
      {children}
    </div>
  );
}
