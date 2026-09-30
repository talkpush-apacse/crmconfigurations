const bars = [
  { label: 'Philippines', value: 22, color: 'var(--color-blue)' },
  { label: 'Colombia', value: 34, color: 'var(--color-green)' },
  { label: 'Egypt', value: 18, color: 'var(--color-blue)' },
  { label: 'Kenya', value: 15, color: 'var(--color-blue)' },
  { label: 'India', value: 20, color: 'var(--color-blue)' },
  { label: 'Mexico', value: 24, color: 'var(--color-blue)' }
];

function FunnelPage({ KpiCard, InsightNote, ChevronFlow }) {
  return (
    <div style={{ background: 'var(--color-beige)', width: '100%', height: '100%', padding: '40px 52px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-body)' }}>
      <Header page="2" />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Application to hire funnel</div>
        <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Every market moved candidates faster this month</h2>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <KpiCard label="Applications" value="23,868" delta="+12.4%" tone="success" />
        <KpiCard label="Conversion rate" value="30.1%" delta="+2.6pt" tone="success" />
        <KpiCard label="Time to fill" value="4.2d" delta="-1.1d" tone="info" />
        <KpiCard label="Backlog" value="612" delta="-8.0%" tone="success" />
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--border-hairline)', borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 120 }}>
          {bars.map(b => (
            <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700 }} className="num">{b.value}%</div>
              <div style={{ width: '100%', height: b.value * 2.6, background: b.color, borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>
      <InsightNote accent="var(--color-green)">Colombia's conversion rate held above 30% for the third straight month, the best of any market this quarter.</InsightNote>
      <ChevronFlow steps={[{ label: 'Sourced · 23,868', color: 'var(--color-green-soft)' }, { label: 'Screened · 9,120', color: 'var(--color-blue-soft)' }, { label: 'Interviewed · 3,340', color: 'var(--color-pink-soft)' }, { label: 'Hired · 1,006', color: 'var(--color-orange-soft)' }]} />
      <Footer page="2" />
    </div>
  );
}

function Header() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="../../assets/logo-mark.jpg" alt="Talkpush" style={{ width: 26, height: 26, borderRadius: 6 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Funnel Report &middot; August 2026</div>
      </div>
      <div style={{ height: 1, background: 'var(--border-hairline)', marginTop: 10 }} />
    </div>
  );
}

function Footer({ page }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 'auto' }}>
      <span>Talkpush &middot; Business Operations</span>
      <span>Page {page} of 3 &middot; Confidential</span>
    </div>
  );
}
window.FunnelPage = FunnelPage;
window.Header = Header;
window.Footer = Footer;
