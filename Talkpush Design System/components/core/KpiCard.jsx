import React from 'react';
import { Badge } from './Badge.jsx';

export function KpiCard({ label, value, delta = null, tone = 'success' }) {
  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md)', padding: '20px 22px', boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{value}</div>
        {delta && <Badge tone={tone}>{delta}</Badge>}
      </div>
    </div>
  );
}
