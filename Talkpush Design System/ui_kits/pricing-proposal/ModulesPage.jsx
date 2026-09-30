const modules = [
  { title: 'Sourcing', color: 'var(--color-green)', tint: 'var(--color-green-lightest)', items: ['Social & job-board attraction', 'Referral capture', 'Landing page builder'] },
  { title: 'Manage & Convert', color: 'var(--color-blue)', tint: 'var(--color-blue-lightest)', items: ['Conversational screening', 'Voice AI interviews', 'Recruiter dashboard'] },
  { title: 'Hire & Onboard', color: 'var(--color-pink)', tint: 'var(--color-pink-lightest)', items: ['Offer & e-signature', 'Document collection', 'Day-one Q&A bot'] }
];

function ModulesPage() {
  return (
    <div className="context-proposal" style={{ background: '#fff', width: '100%', height: '100%', padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-orange)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Meet the platform</span>
      </div>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#000' }}>Three modules cover the full candidate journey</h2>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        {modules.map(m => (
          <div key={m.title} style={{ flex: 1, border: '1px solid var(--border-hairline)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: m.color, padding: '14px 16px', fontWeight: 700, fontSize: 14, color: '#000' }}>{m.title}</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-beige)', flex: 1 }}>
              {m.items.map(it => (
                <div key={it} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                  <span style={{ width: 15, height: 15, flex: 'none', borderRadius: 4, background: m.tint, marginTop: 1 }} />
                  <span>{it}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.ModulesPage = ModulesPage;
