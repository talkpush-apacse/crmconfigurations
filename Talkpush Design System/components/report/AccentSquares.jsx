import React from 'react';

const COLORS = ['var(--color-green)', 'var(--color-blue)', 'var(--color-pink)', 'var(--color-orange)'];

export function AccentSquares({ count = 3, seed = 1 }) {
  const squares = Array.from({ length: Math.min(count, 4) }, (_, i) => {
    const r = (seed * 97 + i * 53) % 100;
    return {
      top: `${8 + ((seed * 13 + i * 29) % 70)}%`,
      left: `${8 + ((seed * 31 + i * 41) % 80)}%`,
      size: 10 + (r % 8),
      rotate: -30 + (r % 60),
      color: COLORS[(seed + i) % 4]
    };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {squares.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size,
          background: s.color, borderRadius: 3, transform: `rotate(${s.rotate}deg)`
        }} />
      ))}
    </div>
  );
}
